'use strict';

const nt4 = require('../networktables/networktables');
const os = require('os');

function getLocalIPAddresses() {
    // https://stackoverflow.com/questions/3653065/get-local-ip-address-in-node-js
    const nets = os.networkInterfaces();
    // const results = Object.create(null); // Or just '{}', an empty object
    let results = [];

    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
            // 'IPv4' is in Node <= 17, from 18 it's a number 4 or 6
            const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4
            if (net.family === familyV4Value && !net.internal) {
                if (!results[name]) {
                    results[name] = [];
                }
                // results[name].push(net.address);
                results.push(net.address);
            }
        }
    }

    return results;
}

function team2IPPrefix(team) {
    return `10.${Math.floor(team / 100)}.${team % 100}.`;
}

class _NetworkTablesManager {
    constructor() {
        this.vm = null;
        this.targetForStage = null;
        this.topicStore = new Map();
        this.simInstance = new nt4.NT4_Client(
            '127.0.0.1',
            (...args) => this.topicAnnounceHandler('sim', ...args),
            (...args) => this.topicUnannounceHandler('sim', ...args),
            (...args) => this.valueUpdateHandler('sim', ...args),
            (...args) => this.connectHandler('sim', ...args),
            (...args) => this.disconnectHandler('sim', ...args),
        );

        this.robotInstance = new nt4.NT4_Client(
            '10.40.96.2', // dummy
            (...args) => this.topicAnnounceHandler('robot', ...args),
            (...args) => this.topicUnannounceHandler('robot', ...args),
            (...args) => this.valueUpdateHandler('robot', ...args),
            (...args) => this.connectHandler('robot', ...args),
            (...args) => this.disconnectHandler('robot', ...args),
        );

        this.isConnected = false;
        this.connectedTo = '';

    }

    connectVariable(id, toTopic) {
        console.log('subscribing to ' + toTopic + ' for ' + id);
        if (!this.topicStore.has(toTopic)) {
            this.topicStore.set(
                toTopic,
                {
                    variables: new Set([id]),
                    subscribers: {
                        robot: this.robotInstance.subscribePeriodic([toTopic], 100/1000),
                        sim: this.simInstance.subscribePeriodic([toTopic], 100/1000),
                    }
                }
            );
        }
        this.topicStore.get(toTopic).variables.add(id);
    }

    disconnectVariable(id) {
        console.log('unsubscribing ' + id);
        for (const [topic, {variables, subscribers}] of this.topicStore) {
            if (variables.has(id)) {
                variables.delete(id);
                if (variables.size == 0) {
                    this.robotInstance.unSubscribe(subscribers.robot);
                    this.simInstance.unSubscribe(subscribers.sim);
                    this.topicStore.delete(topic);
                }
            }
        }
    }

    setVariable(id, toValue) {
        // TODO
    }

    setTeam(team) {
        let ip = team2IPPrefix(team) + '2';
        if (ip == this.robotInstance.serverBaseAddr) return;
        this.robotInstance.serverBaseAddr = ip;
        this.robotInstance.ws.close(); // the code auto restarts the connection
    }

    topicAnnounceHandler(from, newTopic) {
        if (from == 'robot' && this.simInstance.serverConnectionActive) return;
    }

    topicUnannounceHandler(from, oldTopic) {
        if (from == 'robot' && this.simInstance.serverConnectionActive) return;
    }

    valueUpdateHandler(from, topic, timestamp_us, value) {
        if (from == 'robot' && this.simInstance.serverConnectionActive) return;

        if (!this.topicStore.has(topic.name)) {
            console.log(`Got update for unknown topic ${topic.name}. Ignoring.`);
            return;
        }

        this.targetForStage = this.targetForStage || this.vm.runtime.getTargetForStage();
        if (!this.targetForStage) {
            console.log(`Got update for topic ${topic.name}, but no stage is running. Ignoring.`);
            return;
        }

        for (const id of this.topicStore.get(topic.name).variables) {
            let variable = this.targetForStage.lookupVariableById(id);
            if (!variable) {
                console.log(`Got update for topic ${topic.name}, but variable ${id} does not exist. Removing.`);
                this.disconnectVariable(id);
                continue;
            }
            variable.value = value;
        }

    }

    connectHandler(from) {
        this.isConnected = true;
        this.connectedTo = from;
        console.log(`Connected to ${from}!`)
    }

    disconnectHandler(from) {
        console.log(`Disconnected from ${from}!`)
        // this.isConnected = false;
        // this.connectedTo = '';
        // // get new subscription updates from everything
        // let other = from == 'sim' ? this.robotInstance : this.simInstance;
        // if (other.serverConnectionActive) {
        //     other.ws.close();
        // }
    }

}

class NetworkTablesManager {
    constructor() {
        throw new Error('NetworkTablesManager is a singleton, use NetworkTablesManager.getInstance()');
    }

    /**
     * 
     * @returns {_NetworkTablesManager} the singleton instance of the NetworkTablesManager
     */
    static getInstance() {
        if (!NetworkTablesManager.instance) {
            NetworkTablesManager.instance = new _NetworkTablesManager();
        }
        return NetworkTablesManager.instance;
    }
}

module.exports = NetworkTablesManager;
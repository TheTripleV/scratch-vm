/**
 * @fileoverview
 * Object representing a Scratch variable.
 */

const uid = require('../util/uid');
const xmlEscape = require('../util/xml-escape');
const NetworkTablesManager = require('./networktables-manager');

/**
 * We are directly messing with the Variable class to pipe things through NT.
 * This is a hack, but it's the easiest way to do it.
 * Variable properties are directly accessed from all over the place across multiple repos.
 * It's too much to patch everything.
 * NT could be setup as a CloudProvider and the existing cloud variable infrastructure could be used,
 * but scratch.mit.edu only supports 10 cloud variables, and that would be a weird restriction to impose locally.
 * */
class Variable {
    /**
     * @param {string} id Id of the variable.
     * @param {string} name Name of the variable.
     * @param {string} type Type of the variable, one of '' or 'list'
     * @param {boolean} isCloud Whether the variable is stored in the cloud.
     * @constructor
     */
    constructor (id, name, type, isCloud) {
        this._id = id || uid();
        this._name = name;
        this._type = type;
        this.isNT = false;
        this.isCloud = isCloud;
        switch (this.type) {
        case Variable.SCALAR_TYPE:
            this.value = 0;
            break;
        case Variable.LIST_TYPE:
            this.value = [];
            break;
        case Variable.BROADCAST_MESSAGE_TYPE:
            this.value = this.name;
            break;
        default:
            throw new Error(`Invalid variable type: ${this.type}`);
        }

        if (this._name.startsWith("/")) {
            this.isNT = true;
            NetworkTablesManager.getInstance().connectVariable(this._id, this._name);
        }
    }

    set id(newId) {
        this._id = newId;
        console.error('Variable id changed for variable: ' + this.name);
    }

    get id() {
        return this._id;
    }

    set name(newName) {
        console.log(newName);
        if (this.name == newName) return;

        if (this.type === Variable.SCALAR_TYPE) {
            let isOldNameNT = this._name.startsWith("/");
            let isNewNameNT = newName.startsWith("/");
            this.isNT = isNewNameNT;
            if (!isOldNameNT && isNewNameNT) {
                NetworkTablesManager.getInstance().connectVariable(this._id, newName);
            } else if (isOldNameNT && !isNewNameNT) {
                NetworkTablesManager.getInstance().disconnectVariable(this._id);
            } else if (isOldNameNT && isNewNameNT) {
                NetworkTablesManager.getInstance().disconnectVariable(this._id);
                NetworkTablesManager.getInstance().connectVariable(this._id, newName);
            }
        } else {
            this.isNT = false;
        }
        this._name = newName;
    }

    get name() {
        return this._name;
    }

    set type(newType) {
        this._type = newType;
        console.error('Variable type changed for variable: ' + this.name);
    }

    get type() {
        return this._type;
    }

    set value(newValue) {
        this._value = newValue;
        if (this.name == "team number") {
            NetworkTablesManager.getInstance().setTeam(parseInt(newValue));
        }
        if (this.isNT) {
            NetworkTablesManager.getInstance().setVariable(this._id, newValue);
        }
    }

    get value() {
        if (this.name == 'is connected') {
            return NetworkTablesManager.getInstance().isConnected;
        }
        if (this.name == 'connected to') {
            return NetworkTablesManager.getInstance().connectedTo;
        }

        return this._value;
    }

    toXML (isLocal) {
        isLocal = (isLocal === true);
        return `<variable type="${this.type}" id="${this.id}" islocal="${isLocal
        }" iscloud="${this.isCloud}">${xmlEscape(this.name)}</variable>`;
    }

    /**
     * Type representation for scalar variables.
     * This is currently represented as ''
     * for compatibility with blockly.
     * @const {string}
     */
    static get SCALAR_TYPE () {
        return '';
    }

    /**
     * Type representation for list variables.
     * @const {string}
     */
    static get LIST_TYPE () {
        return 'list';
    }

    /**
     * Type representation for list variables.
     * @const {string}
     */
    static get BROADCAST_MESSAGE_TYPE () {
        return 'broadcast_msg';
    }
}

module.exports = Variable;

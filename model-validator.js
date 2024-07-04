const path = require('path');
const fs = require('fs');
const codegen = require('./code-utils')
const {FSMHelpers} = require('./code-helpers')
const { Variable, Dataset } = require('./dataset')

/**
 *
 * FSM Model Validator
 */
class ModelValidator extends FSMHelpers {
    /**
     * @constructor
     *
     * @param {type.UMLStateMachine} baseModel
     * @param {string} basePath generated files and directories to be placed
     */
    constructor(baseModel) {
        super(baseModel)

        this.errors = [];
    }

    checkStateTypes() {
        var states = this.extractStates(this.baseModel, true, true, true);
        const pseudo_states = ['initial', 'fork', 'join', 'choice', 'shallowHistory'];
        states.forEach(state => {
            if (state instanceof type.UMLPseudostate && !pseudo_states.includes(state.kind)) {
                this.errors.push({ 'element': state, 'msg': `PseudoState \'${state.kind}\' isn\'t supported.` });
            }

            if (state.doActivities && state.doActivities.length > 0) {

            }
        });

    }

    checkStateActivities() {
        var states = this.extractStates(this.baseModel, true, true, true);
        states.forEach(state => {
            if (state.doActivities && state.doActivities.length > 0) {
                this.errors.push({ 'element': state, 'msg': `Do Activities aren\'t supported.` });
            }
        });

    }

    checkUniqueStateNames(context) {
        var states = this.extractStates(context, true, true, false),
            names = [];
        states.forEach(state => {
            var name = this.getStateName(state);
            if (names.includes(name)) {
                var parentName = this.getStateName(FSMHelpers.getParent(state));
                this.errors.push({ 'element': state, 'msg': `State name isn\'t unique in \'${parentName}\'.` });
            }
            else {
                names.push(name);
            }

            if (FSMHelpers.isCompositeState(state)) {
                names.push(...this.checkUniqueStateNames(state));
            }
        });

        return names;
    }

    checkUnusedStates() {
        var states = this.extractStates(this.baseModel, true, true, true);
        states.forEach(state => {
            var used = false;
            this.baseModel.regions[0].transitions.forEach(t => {
                if (FSMHelpers.isInitial(state) == false && t.target._id == state._id && t.source._id !== t.target._id) {
                    used = true;
                } else if (FSMHelpers.isInitial(state) == true && t.source._id == state._id && t.source._id !== t.target._id) {
                    used = true;
                }
            });

            if (FSMHelpers.isCompositeState(state)) {

            }
            else if (used ==false) {
                this.errors.push({ 'element': state, 'msg': `State isn't involved in any transition at all.` });
            }
        });
    }

    checkTransitions() {
        var ts = [];
        this.baseModel.regions[0].transitions.forEach( t => {
            var duplicate = false;
            ts.forEach(_t => {
                if (t.source._id == _t.source._id
                    && t.target._id == _t.target._id
                    && t.triggers.length == _t.triggers.length
                    && t.guard == _t.guard) {
                    if (t.triggers.length === 0 || t.triggers[0].name === _t.triggers[0].name) {
                        duplicate = true;
                    }
                    return;
                }
            });

            if (duplicate && !FSMHelpers.isFork(t.source)) {
                this.errors.push({ 'element': t, 'msg': `Transition from \'${this.getStateName(t.source)}\' isn\'t unique.` });
            } else {
                ts.push(t);
            }

            if (t.triggers.length >= 2) {
                this.errors.push({ 'element': t, 'msg': 'Only 1 trigger allowed per transition.' });
            }

            if (FSMHelpers.isFork(t.source) && (t.guard || t.triggers.length > 0)) {
                this.errors.push({ 'element': t, 'msg': 'Forks can\'t have outgoing transitions with triggers or guards.' });
            }

            if (FSMHelpers.isFork(t.source) && !FSMHelpers.isSubState(t.target)) {
                this.errors.push({ 'element': t, 'msg': 'Forks outgoing transitions should be going to a substate.' });
            }

            if (FSMHelpers.isJoin(t.target) && !FSMHelpers.isSubState(t.source)) {
                this.errors.push({ 'element': t, 'msg': 'Joins incoming transitions should be from a substate.' });
            }

            if (FSMHelpers.isCompositeState(t.source) && t.source._id == t.target._id && (t.kind== undefined || t.kind == 'external') && this.getInitialState(t.source) === null) {
                this.errors.push({ 'element': t, 'msg': 'Composite state has no initial sub state. Transition kind \'external\' isn\'t allowed.' });
            }

        });
    }

    validate() {
        this.errors = [];

        if (this.getInitialState() === null) {
            this.errors.push({ 'element': this.baseModel, 'msg': 'StateMachine doesn\'t have an initial state.' });
        }

        this.checkStateTypes();
        this.checkUniqueStateNames(this.baseModel);
        this.checkStateActivities();
        this.checkUnusedStates();
        this.checkTransitions();

        return this.errors;
    }

}

/**
 * Easy use wrapper arround the ModelValidator
 * @param {UMLStateMachine} baseModel
 * @param {string} basePath
 * @param {Dataset} dataset
 * @param {StructuredTextGeneratorOptions} options
 * @returns
 */
function validate(baseModel, basePath, dataset, options) {
    var validator = new ModelValidator(baseModel);
    return validator.validate();
}

exports.validate = validate

const path = require('path');
const fs = require('fs');
// const { v4: uuidv4 } = require('uuid')
const { FSMHelpers } = require('./code-helpers');
const { CodeWriterST } = require('./code-writer-st');
const { CodeWriterPython } = require('./code-writer-python');
const { Variable, Dataset, Location } = require('./dataset');

class StructuredTextGeneratorOptions {
    target = 'st';
    generateType = false;
    generateVars = false;
    generateST = false;
    cstyleComment = false; // when false use (* *) for comment
    haveEnum = true; // platform support enums
    enumValuePrefix = false; // add enum type in front of enumvalue (scoped)
}

/**
 *
 * Structured Text Code Generator
 */
class StructuredTextGenerator  extends FSMHelpers {
    /**
     * @constructor
     *
     * @param {type.UMLStateMachine} baseModel
     * @param {string} basePath generated files and directories to be placed
     */
    constructor(baseModel, basePath, dataset) {
        super(baseModel)

        /** @member {string} */
        this.basePath = basePath

        /** @member {CodeWriter} */
        this.cw = null;

        /** @member {Dataset} */
        this.dataset = dataset;

        /** @member {StructuredTextGeneratorOptions} */
        this.options = new StructuredTextGeneratorOptions();

    }

    /**
     * Write code line and applies substitute if available
     * @param {string} line
     */
    writeLineWithSubstitution(line) {
        this.cw.writeStatement(this.getSubstitute(line.name));
    }

    toComment(comment) {
        if (this.options.cstyleComment) {
            return `// ${comment}`;

        }
        return `(* ${comment} *)`;
    }

    /**
     * Return a lookup table by name from a DataSet
     * @param {string} itemName
     * @returns {string}
     */
    getDatasetItem(itemName) {
        if (typeof this.dataset !== null && itemName in this.dataset) {
             return this.dataset[itemName];
        }
        return [];
    }

    /**
     * Return substite for the given item. If not present return the original
     * @param {string} item an statemachine trigger, guard, effect or activity
     * @returns {string}
     */
    getSubstitute(item) {
        if (this.dataset !== null && item in this.dataset.replacements) {
            return this.dataset.replacements[item];
        }
        return item;
    }

    getInactiveState() {
        var prefix = '';
        if (this.options.enumValuePrefix) {
            prefix = `${this.getEnumType()}.`;
        }
        return `${prefix}${this.getScopePrefix()}_InActive`;
    }

    // ---------------------------------------------------------------------------------------------------
    // Code Generator Functions
    // ---------------------------------------------------------------------------------------------------

    /**
     * With history restor the shallow history state will not become active, but the prev states of the
     * Parent.regions are restored as active.
     * @param {UMLState} state
     * @param {UMLTransition} transition
     */
    handleTransitionHistoryRestore(state, transition) {
        var me = this,
            condition = '';
        FSMHelpers.getParent(transition.target).regions.forEach((_region, _idx) => {
            if (_idx != 0) {
                condition += ' OR ';
            }
            condition += `${me.getPrevStateVar(_region, false)} <> ${me.getInactiveState()}`;
        });

        this.cw.writeIfBegin(condition);

        // hmm is this really correct, what if neste multiple times?
        this.cw.writeAssignment(me.getStateVar(state), me.getStateName(transition.target._parent._parent,true, me.options.enumValuePrefix));

        // get all  (sub)statemachines that should be restored
        var _smsToRestore=me.getStatesBetween(state,transition.target);
        _smsToRestore.push(...me.extractStates(FSMHelpers.getParent(transition.target), false, true, true));
        _smsToRestore.forEach( _smRestore => {
            // for each composite statemachine restore each region of it
            _smRestore.regions.forEach(_regionPar => {
                this.cw.writeAssignment(me.getStateVar(_regionPar, false), me.getPrevStateVar(_regionPar, false));
                this.cw.writeAssignment(me.getPrevStateVar(_regionPar, false), me.getInactiveState());
    }       );
        });
        this.cw.writeIfEnd();
    }

    /**
     * With a transtion to a Join we will have to wait untill all regions of the Composite State are done.
     * @param {UMLState} state
     * @param {UMLTransition} transition
     */
    handleTransitionJoin(state, transition) {
        var me = this,
            condition = '';

        FSMHelpers.getParent(state).regions.filter(r => r._id != FSMHelpers.getRegion(state)._id).forEach((_region, _idx) => {
            if (_idx != 0) {
                condition += ' AND ';
            }
            condition += `${me.getStateVar(_region, false)} = ${me.getInactiveState()}`;
        });

        this.cw.writeIfBegin(condition);
        this.cw.writeAssignment(me.getStateVar(FSMHelpers.getRegion(transition.target), false), me.getStateName(transition.target,true, me.options.enumValuePrefix));
        this.cw.writeAssignment(me.getStateVar(FSMHelpers.getRegion(state), false), me.getInactiveState());
        this.cw.writeElse();
        this.cw.writeAssignment(me.getStateVar(FSMHelpers.getRegion(state), false), me.getInactiveState());
        this.cw.writeIfEnd();
    }

    /**
     * When it isn't a transtion to Shallow History or Join this function will handle it.
     * Most the work is realted to composite states to make sure all parents or child states
     * are correctly dealt with.
     * @param {UMLState} state
     * @param {UMLTransition} transition
     */
    handleTransitionRegular(state, transition) {
        var me = this;
        if (FSMHelpers.isCompositeState(state) ){
            this.cw.writeAssignment(me.getStateVar(state, false), me.getInactiveState());
            this.cw.writeAssignment(me.getPrevStateVar(state, false), me.getInactiveState());
        }

        //TODO: could be merged with the other FSMHelpers.isInnerStateOf, is now only split to keep the original diff working
        if (FSMHelpers.isInnerStateOf(state, transition.target)) {
            var states_up = FSMHelpers.getCompositeStatesBetween(state, transition.target);
            states_up.forEach(_state_ => {
                this.cw.writeAssignment(me.getStateVar(_state_), me.getStateName(_state_, true, me.options.enumValuePrefix));
            });
        }

        // this is the main new state transfer
        this.cw.writeAssignment(me.getStateVar(transition.target), me.getStateName(transition.target, true, me.options.enumValuePrefix));

        if (FSMHelpers.isCompositeState(transition.target)) {
            if (this.getInitialState(transition.target) !== null) {
                this.cw.writeAssignment(me.getStateVar(transition.target, false), me.getStateName(this.getInitialState(transition.target), true, me.options.enumValuePrefix));
            }
            if (FSMHelpers.haveSameParent(state, transition.target) === false) {
                this.cw.writeAssignment(me.getPrevStateVar(transition.target, false), me.getInactiveState());
            }
        }

        if (FSMHelpers.isInnerStateOf(state, transition.target)) {
            var regions_up = FSMHelpers.getCompositeRegionsBetween(state, transition.target);
            regions_up.forEach(_rgn_ => {
                this.cw.writeAssignment(me.getPrevStateVar(_rgn_, false), me.getInactiveState());
            })
        } else if (FSMHelpers.isJoin(transition.target) == false && FSMHelpers.isOuterStateOf(state, transition.target)) {
            var sms_up = FSMHelpers.getCompositeStatesBetween(transition.target, state).reverse();
            sms_up.forEach(_smb_ => {
                _smb_.regions.forEach(_regionPar => {
                    // prevent on self transition that state becomes inactive (overwrite set above)
                    if (transition.source._id != transition.target._id || _smb_._id != transition.source._id) {
                        this.cw.writeAssignment(me.getStateVar(_regionPar, false), me.getInactiveState());
                    }
                }); // end _smb_.regions.
            });  // end  sms_up.forEach
        }

    }

    /**
     * Generate the code for the transition it self (is already checked of it should occure or not)
     * @param {UMLState} state
     * @param {UMLTransition} transition
     */
    handleTransition(state, transition) {
        var me = this,
            isInternalSelfTransition = state._id == transition.target._id && transition.kind && transition.kind == "internal",
            effects = FSMHelpers.extractActivities(state, transition);

        if (isInternalSelfTransition == false && state.exitActivities && state.exitActivities.length > 0) {
            this.cw.writeComment('exitActivities:');
            state.exitActivities.forEach(me.writeLineWithSubstitution, this);
        }

        if (effects.length > 0) {
            this.cw.writeComment('effects stuff');
            effects.forEach(me.writeLineWithSubstitution, this);
        }

        // An 'external' self transtion with retrigger entries
        if (state._id == transition.target._id && isInternalSelfTransition == false) {
            this.cw.writeAssignment(me.getPrevStateVar(state), me.getInactiveState(), 'retrigger entry activities');
        }

        if (FSMHelpers.isRestoreHistory(transition.target)) {
            this.cw.writeComment('restore history');
            me.handleTransitionHistoryRestore(state, transition);
        } else if (FSMHelpers.isJoin(transition.target)) {
            this.cw.writeComment('Join substatemachines');
            me.handleTransitionJoin(state, transition);
        } else if (FSMHelpers.isCompositeState(state) == false || FSMHelpers.isInternalSelfTransition(transition) == false || state._id != transition.source._id) {
            // regular transition
            me.handleTransitionRegular(state, transition);
        }
    }

    /**
     * Generate code for a UMLState or UMLPSeudoState
     * - generate a select for the case
     * - run entries when needed
     * - iterate triggers and transitions per trigger
     * - generate code for event and guard check
     * - dispatch the handling of the transition it self to handleTransition
     * @param {UMLState} state
     */
    handleState(state) {
        var me = this,
            stateName = me.getStateName(state, true, me.options.enumValuePrefix),
            transitions = FSMHelpers.extractTransitions(this.baseModel, state),
            usedTriggers = FSMHelpers.getUsedTriggers(transitions);

        if (FSMHelpers.isSubState(state)) {
            this.cw.writeComment(`Substate ${me.getStateName(FSMHelpers.getParent(state))}.${stateName}`);
        }
        this.cw.writeCaseSelect(stateName);

        // activities
        if (state.entryActivities && state.entryActivities.length > 0) {
            this.cw.writeIfBegin(`${me.getStateVar(state)} <> ${me.getPrevStateVar(state)}`);
            this.cw.writeComment('entryActivities:');
            state.entryActivities.forEach(me.writeLineWithSubstitution, this);
            this.cw.writeIfEnd();
        }

        // set prev state var
        this.cw.writeAssignment(me.getPrevStateVar(state), me.getStateVar(state));
        this.cw.writeLine();

        // iterate triggers
        let nested = false;
        usedTriggers.forEach((triggerName, tidx) => {
            let transitionsPerTrigger = FSMHelpers.getTransitionsForTrigger(triggerName, transitions),
                condStat = null;
            if (triggerName && tidx == 0) {
                condStat = true;
                this.cw.writeIfBegin(me.getSubstitute(triggerName));
            } else if (triggerName) {
                condStat = true;
                this.cw.writeElseIf(me.getSubstitute(triggerName));
            } else if (usedTriggers.length >= 2) {
                condStat = true;
                this.cw.writeElse();
            }

            if (condStat) {
                nested |= true;
            }

            // iterate transitions per triggers
            let nestedTransCond = false;
            transitionsPerTrigger.forEach((transition, ttidx) => {
                let guard = transition.guard || null,
                    condTrans = null;

                // this.writeComment(`${transition._id}`);
                if (guard && ttidx==0) {
                    condTrans = true;
                    this.cw.writeIfBegin(me.getSubstitute(guard), transition._id);
                } else if ( guard ) {
                    condTrans = true;
                    this.cw.writeElseIf(me.getSubstitute(guard), transition._id);
                } else if (FSMHelpers.isFork(state)==false && transitionsPerTrigger.length>1) {
                    this.cw.writeElse(transition._id);
                    condTrans = true;
                }
                else if (FSMHelpers.isCompositeState(state) && transition.triggers.length === 0 && guard == null) {
                    condTrans = true;
                    this.cw.writeIfBegin(`${me.getStateVar(state, false)} = ${me.getStateName(me.getFinalState(state), true,  me.options.enumValuePrefix )}`);
                }
                else {
                    this.cw.writeComment(transition._id);
                }

                if (condTrans) {
                    nestedTransCond |= true;
                }

                // handle transition
                me.handleTransition(state, transition);

                if (condTrans) {
                }

            });
            if (nestedTransCond) {
                this.cw.writeIfEnd();
            }
        });

        if (nested) {
            this.cw.writeIfEnd();
        }

        this.cw.writeCaseSelectEnd();
        this.cw.writeLine();
    }

    /**
     * Handle a UMLRegion.
     * Create a CASE for the region and iterate each State.
     * @param {UMLRegion} region
     */
    handleRegion(region) {
        var me = this;
        var states = me.extractStates(region, true, true, false);
        this.cw.writeCaseBegin(me.getStateVar(region, false));
        states.forEach(me.handleState, me);
        this.cw.writeCaseEnd();
    }

    /**
     * Handle a Statemachine or Composite Statemachine.
     * Iterate each region of it.
     * @param {UMLStateMachine|UMLState} sm
     */
    handleStateMachine(sm) {
        var me = this;
        // When composite state, build precondition that the parent states of the substatemachine must be active
        if (!(sm instanceof type.UMLStateMachine)) {

            let smsBetween = me.getStatesBetween(me.getInitialState(), sm),
                condition = '';
            smsBetween.push(sm);
            smsBetween.forEach( (_sm, _idx) => {
                if (_idx != 0) {
                    condition += ' AND ';
                }
                condition += `${me.getStateVar(_sm, true)} = ${me.getStateName(_sm, true, me.options.enumValuePrefix)} AND ${me.getStateVar(_sm, true)} = ${me.getPrevStateVar(_sm)}`;
            });

            this.cw.writeLine();
            this.cw.writeIfBegin(condition);
        }

        sm.regions.forEach(me.handleRegion, me);

        if (!(sm instanceof type.UMLStateMachine)) {
            this.cw.writeIfEnd();
        }
    }

    /**
     * Generates a TYPE block with an enum with the state values
     */
    addTypeBlock() {
        let me = this,
            states = me.extractStates(this.baseModel, true, true, true),
            names = me.getStateNames(states);

        this.cw.writeEnumType(me.getEnumType(), names);
    }

    /**
     * Generates the VARS section of the statemachine Function Block
     */
    addVars() {
        let me = this,
            compositeStates = me.extractStates(me.baseModel, false, true, true),
            states = me.extractStates(this.baseModel, true, true, true),
            stateNames = me.getStateNames(states, false);

        function getStatesType() {
            if (me.options.haveEnum) {
                return me.getEnumType();
            }
            return 'INT';
        }

        let var_input=[];
        var_input.push(new Variable('ResetStateMachine', 'BOOL', Symbol.VAR_INPUT, 'Used for testing purposes', 'FALSE'));
        var_input.push(...me.getDatasetItem('var_in'));
        this.cw.writeVariables(Location.VarIn, var_input);


        let var_output = [];
        var_output.push(new Variable('eState', getStatesType(), Symbol.VAR_OUTPUT, '', me.getStateName(me.getInitialState(), true, me.options.enumValuePrefix)));
        compositeStates.forEach(state => {
            state.regions.forEach((region,idx_region) => {
                var_output.push(new Variable(`e${me.getRegionName(region, true)}State`, getStatesType(), Symbol.VAR_OUTPUT, '', me.getInactiveState()));
            });
        });
        var_output.push(...me.getDatasetItem('var_out'));
        this.cw.writeVariables(Location.VarOut, var_output);


        this.cw.writeVariables(Location.VarInOut, me.getDatasetItem('var_inout'));

        let vars = [];
        vars.push(new Variable('rtResetStateMachine', 'R_TRIG', Symbol.VAR, '', null ));
        vars.push(new Variable('ePrevState', getStatesType(), Symbol.VAR, '', me.getInactiveState() ));
        compositeStates.forEach(state => {
            state.regions.forEach((region,idx_region) => {
                vars.push(new Variable(`e${me.getRegionName(region, true)}PrevState`, getStatesType(), Symbol.Var, '', me.getInactiveState()));
            });
        });
        vars.push(...me.getDatasetItem('var_private'));
        this.cw.writeVariables(Location.Var, vars);


        // adds an array with al the state names
        let var_const = [],
            value = [];
        if (me.options.target != 'scl') {
            var_const.push(new Variable('StateNames', `ARRAY[0..${stateNames.length - 1}] OF STRING`, Symbol.VarConst, '', stateNames ));
        }
        if (me.options.haveEnum == false) {
            var names = me.getStateNames(states);
            names.forEach((stateName, idx, thearay) => {
                var_const.push(new Variable(`${stateName}`, 'INT', Symbol.VarConst, '', `${idx}` ));
            });
        }
        this.cw.writeVariables(Location.VarConst, var_const);
    }

    /**
     * Parse a single statemachine (this.baseMmodel) and generates the ST code of of it.
     * @param {StructuredTextGeneratorOptions} options
     */
    generate(options) {
        var me = this;
        me.options = options;

        console.log('target = ' + me.options.target);
        if (me.options.target == 'scl') {
            me.options.cstyleComment = true;
            me.options.haveEnum = false;
            me.options.generateType = false;
        } else if (me.options.target == 'plcopen') {
            me.options.enumValuePrefix = true;
        } else if (me.options.target == 'py') {
            me.options.enumValuePrefix = true;
        }


        FSMHelpers.scopeEnumValueWithType = me.options.enumValuePrefix;

        if (me.options.target != 'py') {
            this.cw = new CodeWriterST();
        } else {
            this.cw = new CodeWriterPython();
        }
        if (this.baseModel instanceof type.UMLStateMachine) {
            var compositeStates = me.extractStates(me.baseModel , false, true, true),
                stateMachines = [me.baseModel];

            // Each Composite State is also threated as a StateMachine
            stateMachines.push(...compositeStates);

            if (me.options.generateType) {
                me.addTypeBlock();
                this.cw.writeLine();
            }

            if (me.options.generateVars || me.options.generateST) {
                this.cw.writeStateMachineBegin(me.getStateMachineName(), this.baseModel.documentation);
            }

            if (me.options.generateVars) {
                me.addVars();
            }

            if (me.options.generateST) {
                var comment = this.baseModel.documentation ? this.baseModel.documentation : '';
                this.cw.writeLine();
                this.cw.writeBodyBegin();

                // add ResetStateMachine handler
                this.cw.writeStatement('rtResetStateMachine(CLK:=ResetStateMachine)');
                this.cw.writeIfBegin('rtResetStateMachine.Q');
                this.cw.writeAssignment('eState', me.getStateName(me.getInitialState(), true,  me.options.enumValuePrefix));
                this.cw.writeAssignment('ePrevState', me.getInactiveState());
                compositeStates.forEach(state => {
                    state.regions.forEach((region, idx_region) => {
                        // reset also substates
                        this.cw.writeAssignment(`e${me.getRegionName(region, true)}State`, me.getInactiveState());
                        this.cw.writeAssignment(`e${me.getRegionName(region, true)}PrevState`,me.getInactiveState());
                    });
                });
                this.cw.writeReturn();
                this.cw.writeIfEnd();
                this.cw.writeLine();

                // insert additional code provided by the variable extractor
                me.getDatasetItem('body_pre').forEach(line => {
                    this.cw.writeStatement(line);
                });

                stateMachines.forEach(me.handleStateMachine, me);
                this.cw.writeBodyEnd();
            }
            if (options.generateVars || options.generateST) {
                    this.cw.writeStateMachineEnd();
                    //fs.writeFileSync(path.join(me.basePath, 'out', 'test.st'), me.cw.getData(), { encoding: "utf-8" });
            }
            console.log(me.cw.getData());
        }
    }
}

/**
 * Easy use wrapper arround the StructuredTextGenerator
 * @param {UMLStateMachine} baseModel
 * @param {string} basePath
 * @param {Dataset} dataset
 * @param {StructuredTextGeneratorOptions} options
 * @returns
 */
function generate(baseModel, basePath, dataset, options) {
    var generator = new StructuredTextGenerator(baseModel, basePath, dataset);
    generator.generate(options);
    return generator.cw.getData();
}

exports.StructuredTextGeneratorOptions = StructuredTextGeneratorOptions
exports.StructuredTextGenerator = StructuredTextGenerator
exports.generate = generate

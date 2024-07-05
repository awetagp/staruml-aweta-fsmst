const path = require('path');
const fs = require('fs');
const codegen = require('./code-utils')
const {FSMHelpers} = require('./code-helpers')
const { Variable, Dataset } = require('./dataset')

class StructuredTextGeneratorOptions {
    target = 'st';
    generateType = false;
    generateVars = false;
    generateST = false;
    cstyleComment = false;
    haveEnum = true;
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
        this.cw.writeLine(`${this.getSubstitute(line.name)};`);
    }

    toComment(comment) {
        if (this.options.cstyleComment) {
            return `// ${comment}`;

        }
        return `(* ${comment} *)`;
    }

    writeComment(comment) {
        this.cw.writeLine(this.toComment(comment));
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
        return `${this.getScopePrefix()}_InActive`;
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

        this.cw.writeLine(`IF ${condition} THEN`);
        this.cw.indent();

        // hmm is this really correct, what if neste multiple times?
        this.cw.writeLine(`${me.getStateVar(state)} := ${me.getStateName(transition.target._parent._parent)};`);

        // get all  (sub)statemachines that should be restored
        var _smsToRestore=me.getStatesBetween(state,transition.target);
        _smsToRestore.push(...me.extractStates(FSMHelpers.getParent(transition.target), false, true, true));
        _smsToRestore.forEach( _smRestore => {
            // for each composite statemachine restore each region of it
            _smRestore.regions.forEach(_regionPar => {
                this.cw.writeLine(`${me.getStateVar(_regionPar, false)} := ${me.getPrevStateVar(_regionPar, false)};`);
                this.cw.writeLine(`${me.getPrevStateVar(_regionPar, false)} := ${me.getInactiveState()};`);
    }       );
        });

        this.cw.outdent();
        this.cw.writeLine('END_IF;');
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

        this.cw.writeLine(`IF ${condition} THEN`);
        this.cw.indent();
        this.cw.writeLine(`${me.getStateVar(FSMHelpers.getRegion(transition.target), false)} := ${me.getStateName(transition.target)};`);
        this.cw.writeLine(`${me.getStateVar(FSMHelpers.getRegion(state), false)} := ${me.getInactiveState()};`);
        this.cw.outdent();
        this.cw.writeLine('ELSE');
        this.cw.indent();
        this.cw.writeLine(`${me.getStateVar(FSMHelpers.getRegion(state), false)} := ${me.getInactiveState()};`);
        this.cw.outdent();
        this.cw.writeLine('END_IF;');
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
            this.cw.writeLine(`${me.getStateVar(state, false)} := ${me.getInactiveState()};`);
            this.cw.writeLine(`${me.getPrevStateVar(state, false)} := ${me.getInactiveState()};`);
        }

        //TODO: could be merged with the other FSMHelpers.isInnerStateOf, is now only split to keep the original diff working
        if (FSMHelpers.isInnerStateOf(state, transition.target)) {
            var states_up = FSMHelpers.getCompositeStatesBetween(state, transition.target);
            states_up.forEach(_state_ => {
                this.cw.writeLine(`${me.getStateVar(_state_)} := ${me.getStateName(_state_)};`);
            });
        }

        // this is the main new state transfer
        this.cw.writeLine(`${me.getStateVar(transition.target)} := ${me.getStateName(transition.target)};`);

        if (FSMHelpers.isCompositeState(transition.target)) {
            if (this.getInitialState(transition.target) !== null) {
                this.cw.writeLine(`${me.getStateVar(transition.target, false)} := ${me.getStateName(this.getInitialState(transition.target))};`);
            }
            if (FSMHelpers.haveSameParent(state, transition.target) === false) {
                this.cw.writeLine(`${me.getPrevStateVar(transition.target, false)} := ${me.getInactiveState()};`);
            }
        }

        if (FSMHelpers.isInnerStateOf(state, transition.target)) {
            var regions_up = FSMHelpers.getCompositeRegionsBetween(state, transition.target);
            regions_up.forEach(_rgn_ => {
                this.cw.writeLine(`${me.getPrevStateVar(_rgn_, false)} := ${me.getInactiveState()};`);
            })
        } else if (FSMHelpers.isJoin(transition.target) == false && FSMHelpers.isOuterStateOf(state, transition.target)) {
            var sms_up = FSMHelpers.getCompositeStatesBetween(transition.target, state).reverse();
            sms_up.forEach(_smb_ => {
                _smb_.regions.forEach(_regionPar => {
                    // prevent on self transition that state becomes inactive (overwrite set above)
                    if (transition.source._id != transition.target._id || FSMHelpers.getParent(state)._id != transition.source._id) {
                        this.cw.writeLine(`${me.getStateVar(_regionPar, false)} := ${me.getInactiveState()};`);
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
            this.writeComment('exitActivities:');
            state.exitActivities.forEach(me.writeLineWithSubstitution, this);
        }

        if (effects.length > 0) {
            this.writeComment('effects stuff');
            effects.forEach(me.writeLineWithSubstitution, this);
        }

        // An 'external' self transtion with retrigger entries
        if (state._id == transition.target._id && isInternalSelfTransition == false) {
            this.cw.writeLine(`${me.getPrevStateVar(state)} := ${me.getInactiveState()}; ${this.toComment('retrigger entry activities')}`);
        }

        if (FSMHelpers.isRestoreHistory(transition.target)) {
            this.writeComment('restore history');
            me.handleTransitionHistoryRestore(state, transition);
        } else if (FSMHelpers.isJoin(transition.target)) {
            this.writeComment('Join substatemachines');
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
            stateName = me.getStateName(state),
            transitions = FSMHelpers.extractTransitions(this.baseModel, state),
            usedTriggers = FSMHelpers.getUsedTriggers(transitions);

        if (FSMHelpers.isSubState(state)) {
            this.writeComment(`Substate ${me.getStateName(FSMHelpers.getParent(state))}.${stateName}`);
        }
        this.cw.writeLine(`${stateName}:`);
        this.cw.indent();

        // activities
        if (state.entryActivities && state.entryActivities.length > 0) {
            this.cw.writeLine(`IF ${me.getStateVar(state)} <> ${me.getPrevStateVar(state)} THEN`);
            this.cw.indent();
            this.writeComment('entryActivities:');
            state.entryActivities.forEach(me.writeLineWithSubstitution, this);
            this.cw.outdent();
            this.cw.writeLine('END_IF;');
        }

        // set prev state var
        this.cw.writeLine(`${me.getPrevStateVar(state)} := ${me.getStateVar(state)};`);
        this.cw.writeLine();

        // iterate triggers
        let nested = false;
        usedTriggers.forEach((triggerName, tidx) => {
            let transitionsPerTrigger = FSMHelpers.getTransitionsForTrigger(triggerName, transitions),
                condStat = null;
            if (triggerName && tidx == 0) {
                condStat=`IF ${me.getSubstitute(triggerName)} THEN`;
            } else if (triggerName) {
                condStat=`ELSIF ${me.getSubstitute(triggerName)} THEN`;
            } else if (usedTriggers.length >= 2) {
                condStat='ELSE';
            }

            if (condStat) {
                nested |= true;
                this.cw.writeLine(condStat);
                this.cw.indent();
            }

            // iterate transitions per triggers
            let nestedTransCond = false;
            transitionsPerTrigger.forEach((transition, ttidx) => {
                let guard = transition.guard || null,
                    condTrans = null;

                this.writeComment(`${transition._id}`);
                if (guard && ttidx==0) {
                    condTrans = `IF ${me.getSubstitute(guard)} THEN`
                } else if ( guard ) {
                    condTrans = `ELSIF ${me.getSubstitute(guard)} THEN`
                } else if (FSMHelpers.isFork(state)==false && transitionsPerTrigger.length>1) {
                    condTrans = 'ELSE'
                }
                else if (FSMHelpers.isCompositeState(state) && transition.triggers.length === 0 && guard == null) {
                    condTrans = `IF ${me.getStateVar(state, false)} = ${me.getStateName(me.getFinalState(state))} THEN`
                }

                if (condTrans) {
                    nestedTransCond |= true;
                    this.cw.writeLine(condTrans);
                    this.cw.indent();
                }

                // handle transition
                me.handleTransition(state, transition);

                if (condTrans) {
                    this.cw.outdent();
                }

            });
            if (nestedTransCond) {
                this.cw.writeLine('END_IF;');
            }

            if (condStat) {
                this.cw.outdent();
            }
        });

        if (nested) {
            this.cw.writeLine('END_IF;');
        }

        this.cw.outdent();
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
        this.cw.writeLine(`CASE ${me.getStateVar(region, false)} OF`);
        this.cw.indent();
        states.forEach(me.handleState, me);
        this.cw.outdent();
        this.cw.writeLine('END_CASE;');
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
                condition += `${me.getStateVar(_sm, true)} = ${me.getStateName(_sm)} AND ${me.getStateVar(_sm, true)} = ${me.getPrevStateVar(_sm)}`;
            });

            this.cw.writeLine();
            this.cw.writeLine(`IF ${condition} THEN`);
            this.cw.indent();
        }

        sm.regions.forEach(me.handleRegion, me);

        if (!(sm instanceof type.UMLStateMachine)) {
            this.cw.outdent();
            this.cw.writeLine('END_IF;');
        }
    }

    /**
     * Generates a TYPE block with an enum with the state values
     */
    addTypeBlock() {
        let me = this,
            states = me.extractStates(this.baseModel, true, true, true),
            names = me.getStateNames(states);

        this.cw.writeLine('TYPE');
        this.cw.indent();
        this.cw.writeLine(`E_${me.getStateMachineName()}_States : (`);
        this.cw.indent();
        names.forEach((stateName, idx, thearay) => {
            let postfix = ',';
            if (idx === 0) {
                postfix = ' := 0,';
            }
            else if (idx === thearay.length - 1) {
                postfix = '';
            }
            this.cw.writeLine(`${stateName}${postfix}`);
        });
        this.cw.outdent();
        this.cw.writeLine(');');
        this.cw.outdent();
        this.cw.writeLine('END_TYPE');
    }

    /**
     * Generate from a Variable class a ST var line like NAME: TYPE; (* comment *)
     * @param {Variable} variable
     */
    addDatasetVar(variable) {
        let comment = variable.comment!= '' ? ` ${this.toComment(variable.comment)}`: '';
        this.cw.writeLine(`${variable.name} : ${variable.datatype};${comment}`);
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
                return `E_${me.getStateMachineName()}_States`;
            }
            return 'INT';
        }
        this.cw.writeLine('VAR_INPUT');
        this.cw.indent();
        this.cw.writeLine(`ResetStateMachine: BOOL := FALSE; ${this.toComment('Used for testing purposes')}`);
        me.getDatasetItem('var_in').forEach(me.addDatasetVar, me);
        this.cw.outdent();
        this.cw.writeLine('END_VAR');
        this.cw.writeLine();

        this.cw.writeLine('VAR_OUTPUT');
        this.cw.indent();
        this.cw.writeLine(`eState : ${getStatesType()} := ${me.getStateName(me.getInitialState())};`);
        compositeStates.forEach(state => {
            state.regions.forEach((region,idx_region) => {
                this.cw.writeLine(`e${me.getRegionName(region, true)}State : ${getStatesType()} := ${me.getInactiveState()};`);
            });
        });
        me.getDatasetItem('var_out').forEach(me.addDatasetVar, me);
        this.cw.outdent();
        this.cw.writeLine('END_VAR');
        this.cw.writeLine();

        if (me.getDatasetItem('var_inout').length > 0) {
            this.cw.writeLine('VAR_IN_OUT');
            this.cw.indent();
            me.getDatasetItem('var_inout').forEach(me.addDatasetVar, me);
            this.cw.outdent();
            this.cw.writeLine('END_VAR');
            this.cw.writeLine();
        }

        this.cw.writeLine('VAR');
        this.cw.indent();
        this.cw.writeLine('rtResetStateMachine: R_TRIG;');
        this.cw.writeLine(`ePrevState : ${getStatesType()} := ${me.getInactiveState()};`);
        compositeStates.forEach(state => {
            state.regions.forEach((region,idx_region) => {
                this.cw.writeLine(`e${me.getRegionName(region, true)}PrevState : ${getStatesType()} := ${me.getInactiveState()};`);
            });
        });
        me.getDatasetItem('var_private').forEach(me.addDatasetVar, me);

        this.cw.outdent();
        this.cw.writeLine('END_VAR');
        this.cw.writeLine();

        // adds an array with al the state names
        this.cw.writeLine('VAR CONSTANT');
        this.cw.indent();
        if (me.options.target != 'scl') {
            this.cw.writeLine(`StateNames : ARRAY[0..${stateNames.length - 1}] OF STRING := [`);
            this.cw.indent();
            stateNames.forEach((stateName, idx, thearay) => {
                let postfix = ',';
                if (idx === thearay.length - 1) {
                    postfix = '';
                }
                this.cw.writeLine(`'${stateName}'${postfix}`);
            });

            this.cw.outdent();
            this.cw.writeLine('];');
        }
        if (me.options.haveEnum == false) {
            var names = me.getStateNames(states);
            names.forEach((stateName, idx, thearay) => {
                this.cw.writeLine(`${stateName}: INT := ${idx};`);
            });
        }
        this.cw.outdent();
        this.cw.writeLine('END_VAR');
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
        }

        this.cw = new codegen.CodeWriter();
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
                var comment = this.baseModel.documentation ? ` ${this.toComment(this.baseModel.documentation)}` : '';
                this.cw.writeLine(`FUNCTION_BLOCK FB_${me.getStateMachineName()}${comment}`);
                this.cw.indent();
            }

            if (me.options.generateVars) {
                me.addVars();
            }

            if (me.options.generateST) {
                var comment = this.baseModel.documentation ? ` ${this.toComment(this.baseModel.documentation)}` : '';
                this.cw.writeLine();

                // add ResetStateMachine handler
                this.cw.writeLine('rtResetStateMachine(CLK:=ResetStateMachine);');
                this.cw.writeLine('IF rtResetStateMachine.Q THEN');
                this.cw.indent();
                this.cw.writeLine(`eState := ${me.getStateName(me.getInitialState())};`);
                this.cw.writeLine(`ePrevState := ${me.getInactiveState()};`);
                compositeStates.forEach(state => {
                    state.regions.forEach((region, idx_region) => {
                        // reset also substates
                        this.cw.writeLine(`e${me.getRegionName(region, true)}State := ${me.getInactiveState()};`);
                        this.cw.writeLine(`e${me.getRegionName(region, true)}PrevState := ${me.getInactiveState()};`);
                    });
                });
                this.cw.writeLine('RETURN;');
                this.cw.outdent();
                this.cw.writeLine('END_IF;');
                this.cw.writeLine();

                // insert additional code provided by the variable extractor
                me.getDatasetItem('body_pre').forEach(line => {
                    this.cw.writeLine(`${line};`);
                });

                stateMachines.forEach(me.handleStateMachine, me);
            }
            if (options.generateVars || options.generateST) {
                    this.cw.outdent();
                    this.cw.writeLine('END_FUNCTION_BLOCK');
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


class FSMHelpers {

    scopeEnumValueWithType = false;

    /**
     * @constructor
     *
     * @param {type.UMLStateMachine} baseModel
     */
    constructor(baseModel, basePath) {
        /** @member {type.UMLStateMachine} */
        this.baseModel = baseModel

        /** @member {string} */
        this.basePath = basePath

        /** @member {CodeWriter} */
        this.codeWriter = null;
    }

    getStateMachineName() {
        return this.baseModel.name.replaceAll(' ','_').trim();
    }

    getScopePrefix() {
        // to make names unique add statemachine name or fsm_prefix property
        var _prefix=this.baseModel.name;
        if( this.baseModel.tags) {
            this.baseModel.tags.forEach(_tag => {
                if(_tag.name === 'fsm_prefix') {
                    _prefix = _tag.value;
                    return;
                }
           });
        }
        return _prefix;
    }

    static isCompositeState(astate) {
        return astate instanceof type.UMLState && astate.regions.length >0;
    }

    static  isSubState(a_state) {
        return a_state._parent._parent instanceof type.UMLState;
    }

    static  isCompositeMultiRegionState(astate) {
        return astate instanceof type.UMLState && astate.regions.length >=2;
    }

    static isRestoreHistory(a_target) {
        return FSMHelpers.isSubState(a_target) && a_target instanceof type.UMLPseudostate && a_target.kind == "shallowHistory";
    }

    static isFork(a_target) {
        return a_target instanceof type.UMLPseudostate && a_target.kind == "fork";
    }

    static  isInitial(a_target) {
        return a_target instanceof type.UMLPseudostate && a_target.kind == "initial";
    }

    static  isJoin(a_target) {
        return a_target instanceof type.UMLPseudostate && a_target.kind == "join";
    }

    static  isChoice(a_target) {
        return a_target instanceof type.UMLPseudostate && a_target.kind == "choice";
    }

    static getParent(a_state) {
        //return is_composite_state(a_state._parent._parent) ? a_state._parent._parent : null;
        return a_state._parent._parent;
    }

    getRegionName(a_region, short=false) {
        var _parent = a_region._parent,
            _region = a_region,
            _region_idx = null;

        if(a_region.name) {
            return a_region.name;
        }

        _parent.regions.forEach((aregion, _idx) => {
            if (aregion._id === _region._id) {
                _region_idx = _idx;
                return;
            }
        })

        return `${this.getStateName(_parent, short!=true)}R${_region_idx}`;
    }

    getStateVar(context, fromParent=true, postFix='State') {
        var _stateVar,
                isRegion=context instanceof type.UMLRegion;

            if( isRegion) {
                if(fromParent == false) {
                    var _region = context,
                        _sm_context = isRegion ? context._parent: context;
                    _stateVar = _region._parent._id === this.baseModel._id ? '' :  `${this.getRegionName(_region, true)}`;
                } else {
                    _stateVar = context._parent._id === this.baseModel._id ? '' :  `${this.getRegionName(_region, true)}`;
                }
            } else {

                if(fromParent == false) {
                    _stateVar = context._id === this.baseModel._id ? '' :  `${this.getRegionName(context.regions[0], true)}`;
                } else {
                    _stateVar = FSMHelpers.getParent(context)._id === this.baseModel._id ? '' :  `${this.getRegionName(FSMHelpers.getRegion(context), true)}`;
                }
            }
        return `e${_stateVar}${postFix}`;
    }

    getPrevStateVar(context, fromParent = true) {
        return this.getStateVar(context, fromParent, 'PrevState');
    }

    static _getNameBasedOnId(_id) {
        var _sub = '';

        for (let idx = _id.length-4; idx < _id.length; idx++) {
            if (_id[idx].match(/[a-zA-Z0-9_-]/i)) {
                _sub += _id[idx];
            }
        };
        return _sub;
    }

    getEnumType() {
        return `E_${this.getStateMachineName()}_States`
    }

    getStateName(state, addPrefix=true, addType=false) {
        // return 'escaped' version of the state name
        var me = this,
            _state_name = '';
        if (addType) {
            _state_name += me.getEnumType()+".";
        }
        if(addPrefix) {
            _state_name+= this.getScopePrefix()+'_';
        }
        if (state.name) {
            _state_name += state.name.replaceAll(' ','_');
        } else if (state instanceof type.UMLPseudostate && state.kind == 'initial') {
            _state_name += 'Init_'+FSMHelpers._getNameBasedOnId(state._id);
        } else if (state instanceof type.UMLFinalState ) {
            _state_name += 'Final_'+FSMHelpers._getNameBasedOnId(state._id);
        } else if (FSMHelpers.isJoin(state)) {
            _state_name += 'Join_'+FSMHelpers._getNameBasedOnId(state._id);
        } else if (FSMHelpers.isFork(state)) {
            _state_name += 'Fork_'+FSMHelpers._getNameBasedOnId(state._id);
        }  else if (FSMHelpers.isChoice(state)) {
            _state_name += 'Choice_'+FSMHelpers._getNameBasedOnId(state._id);
        }

        return _state_name;
    }

    extractStates(context, include_normal_states = true, include_composed_states = false, recursive = true) {
        // extract the states of the supplied context which is a StateMachine, State or a Region
        var _state,
            _states = [],
            _check_states = [],
            _regions = [],
            _context_sm = context,
            _initial_state = null;

        if( context instanceof type.UMLRegion) {
            _regions= [context];
            _context_sm = context._parent;
        }
        else if(context.regions) {
            _regions= context.regions;
        }

        if( include_normal_states && context instanceof type.UMLStateMachine || context._parent instanceof type.UMLStateMachine) {
            _initial_state = this.getInitialState()
            if (_initial_state) {
                _states.push(_initial_state);
            }
        }

        _regions.forEach(_aregion => {
            if(_aregion.vertices) {
                _check_states.push(..._aregion.vertices);
            }
            if(_aregion.ownedElements) {
                _check_states.push(..._aregion.ownedElements);
            }
        });

        _check_states.forEach(_state => {
            //const include_states = ['initial', 'join', 'fork'],
            const  excludes_states = ['shallowHistory'];
            if(_initial_state!== null &&_initial_state._id == _state._id) {
            //     // is already added at the front
            }else if(_state instanceof type.UMLPseudostate && excludes_states.includes(_state.kind) == true) {
                // do nothing
            }
            else if(FSMHelpers.isCompositeState(_state)) {
                if(include_composed_states) {
                    _states.push(_state);
                }
                if (recursive) {
                    _states.push(...this.extractStates(_state, include_normal_states, include_composed_states, recursive));
                }
            }else if(include_normal_states) {
                _states.push(_state);
            }
        });

        return _states;
    }

    static getRegion(a_state) {
        if ( a_state._parent instanceof type.UMLRegion ) {
            return a_state._parent;
        }
        return null;
    }


    _getStates(context=null) {
        var _root_states = [];
        if(context === null) {
            context = this.baseModel;
        }

        if(context.regions && context.regions.length>=1) {
            context.regions.forEach(region => {
                if(region.vertices) {
                    _root_states.push(...region.vertices);
                }
                if(region.ownedElements) {
                    _root_states.push(...region.ownedElements);
                }
            });
        }
        return _root_states;
    }

    getInitialState(context=null) {
        var _initial_state = null,
            _root_states = this._getStates(context);

        _root_states.forEach(_state => {
            if((_state instanceof type.UMLPseudostate) &&  _state.kind == 'initial') {
                _initial_state = _state;
                return;
            }
        });

        return _initial_state;
    }

    getFinalState(context=null) {
        var _final_state = null,
            _root_states = this._getStates(context);

        _root_states.forEach(_state => {
            if((_state instanceof type.UMLFinalState) ) {
                _final_state = _state;
                return;
            }
        });

        return _final_state;
    }

    static sortTransitions(transitions, composed) {
        /* negative a becomes before b
           positive a becomes after b
           0 a is equal to b
           */
        var composedCheck = composed || false;
        function compareTransitions(a,b) {
            var trigger_a = a.triggers.length >= 1 ? true : false,
                trigger_b = b.triggers.length >= 1 ? true : false,
                guard_a = a.guard ? true : false,
                guard_b = b.guard ? true : false,
                self_a = a.source._id == a.target._id, //TODO: have to take composed into account
                self_b = b.source._id == b.target._id;
                // intial_a = a.source instanceof type.UMLPseudostate && a.source.kind == 'initial',
                // intial_b = b.source instanceof type.UMLPseudostate && b.source.kind == 'initial';

            if (composedCheck) {
                self_a = FSMHelpers.isInnerStateOf(a.source, a.target);
                self_b = FSMHelpers.isInnerStateOf(b.source, b.target);
            }
            // if(intial_a && !intial_b) {
            //     return -1;
            // }
            // else if(!intial_a && intial_b) {
            //     return 1;
            // }
            // }
            // else {
                // if(self_a && !self_b && a.source._id=== b.source._id) {
                //     return 1;
                // }else if(!self_a && self_b && a.source._id=== b.source._id) {
                //     return -1;
                if(self_a && !self_b) {
                    return 1;
                }else if(!self_a && self_b) {
                    return -1;
                }else if(a.target._id != b.target._id) {
                    return -1;
                } else {
                    if(trigger_a && !trigger_b) {
                        return -1;
                    }else if(!trigger_a && trigger_b) {
                        return 1;
                    }else if(trigger_a && trigger_b && a.triggers.length > b.triggers.length) {
                        return -1;
                    }else if(trigger_a && trigger_b && a.triggers.length < b.triggers.length) {
                        return 1;
                    } else if(guard_a && !guard_b) {
                        return -1;
                    }else if(!guard_a && guard_b) {
                        return 1;
                    }
                    else {
                        return 0;
                    }
                }
            // }
        };

        return transitions.sort(compareTransitions);
    }

    static variableSortFn(varA, varB) {
        if (varA.name < varB.name) {
            return -1;
        }
        else if (varA.name > varB.name) {
            return 1;
        }
        return 0;
    }

    static isInternalSelfTransition(transition) {
        return transition.source._id == transition.target._id
        && transition.kind != undefined
        && transition.kind == 'internal';
    }

    static extractTransitions(model, state) {
        // extract transitions for this state

        var is_final_substate = false,
                _transitions = [],
            composite_state_default_transition = null,
            _comps_state,
            _comp_states = [];

        _comps_state = state;
        while(FSMHelpers.isSubState(_comps_state)) {
            _comps_state = _comps_state._parent._parent;
            _comp_states.push(_comps_state);
        };

        model.regions[0].transitions.forEach(transition => {
            if(state._id == transition.source._id ) {
                _transitions.push(transition);
            }
            else if (FSMHelpers.isSubState(state)) {
                _comp_states.forEach(_comp_state => {

                    if (_comp_state._id == transition.source._id) {
                        var internalSelfTransition = state.id_ != transition.target._id // only when state isn't the the same as source/target
                            && FSMHelpers.isInternalSelfTransition(transition);
                        if (transition.triggers.length >= 1 || (transition.guard && transition.guard != '')) {
                            if (internalSelfTransition == false) {
                                _transitions.push(transition);
                            }
                        }
                    }

                });

            }
        });

        if (FSMHelpers.isCompositeState(state)) {
            // for composite state only do default transitions (no trigger event) without guard
            _transitions = _transitions.filter(t => (t.triggers.length==0 && t.guard=='') || (FSMHelpers.isInternalSelfTransition(t) && t.source._id == state._id ));
        }
        _transitions = FSMHelpers.sortTransitions(_transitions);

        return _transitions;
    }

    static getUsedTriggers(transitions, exclude_empty = false) {
        var _triggers = [];
        transitions.forEach(transition => {
            if(transition.triggers.length >=1 ) {
                if (transition.triggers[0].name && (typeof transition.triggers[0].name === 'undefined' || transition.triggers[0].name === '')) {
                    if( exclude_empty == false) {
                        _triggers.push(null);
                    }
                }else {
                    _triggers.push(transition.triggers[0].name);
                }
            } else if(exclude_empty== false) {
                _triggers.push(null);
            }

        });

        _triggers = Array.from(new Set(_triggers));

        // mkae sure transition with out trigger are on the end
        if( _triggers.indexOf(null) != -1) {
            _triggers.push(_triggers.splice(_triggers.indexOf(null), 1)[0]);
        }
        return _triggers;
    }

    static getTransitionsForTrigger(trigger, transitions) {
        var transitions_with_trigger = [],
            trigger_name = trigger !== null ? trigger : '';
        transitions.forEach(transition => {
            if(trigger == null && transition.triggers.length == 0) {
                transitions_with_trigger.push(transition);
            } else if(transition.triggers.length >=1 && transition.triggers[0].name== trigger_name) {
                transitions_with_trigger.push(transition);
            }
        });
        transitions_with_trigger = FSMHelpers.sortTransitions(transitions_with_trigger, true);
        return transitions_with_trigger;
    }

    getStatesBetween(state_a, state_b) {
        // find the statemachine (statemachines or composite states) when transtion from state_a to state_b is done
        var share_parent = false,
            parent = state_b._parent._parent,
            _state = state_b,
            sms = [];

        while(FSMHelpers.isCompositeState(FSMHelpers.getParent(_state)) ) {
            if( FSMHelpers.getParent(state_a)._id == FSMHelpers.getParent(_state)._id) {
                share_parent = true;
                break;
            }
            _state = FSMHelpers.getParent(_state);
            sms.push(_state);
        }
        return sms;
    }

    getStateNames(states, addPrefix=true) {
        var _names= addPrefix ? [this.getScopePrefix()+'_InActive']: ['InActive'];

        states.forEach(_state => {
            if( _names.includes(_state)===false) {
                _names.push(this.getStateName(_state, addPrefix));
            }
        });
        return _names;
    }

    static extractActivities(a_state, a_transition) {
        var _effects = [],
            _comps_state = a_state,
            share_parent = false;

        var parent = a_transition.target._parent._parent;
        while(FSMHelpers.isCompositeState(parent) ) {
            if( a_state._parent._parent._id == parent._id) {
                share_parent = true;
                break;
            }
            parent = parent._parent._parent;
        }

        // only add exitActivities of Compsite states when we are going up in the tree (leaving a composite state)
        if(share_parent == false ) {
            // when current state is substate add the exit effects of the parents to the transition effects
            while(FSMHelpers.isSubState(_comps_state)) {
                _comps_state = _comps_state._parent._parent;


                if(a_transition.target._parent._parent._id == _comps_state._id )
                        {
                    break;
                }

                _effects.push(..._comps_state.exitActivities);

                // don't go to deeper that the transition
                if(a_transition.target._parent._id == _comps_state._parent._id) {
                    break;
                }
            }
        }

        if(a_transition) {
            _effects.push(...a_transition.effects);
        }

        return _effects;
    }

    static isInnerStateOf(state_from, state_to) {
        // does state_in share a (recursive) parent with state_in
        return FSMHelpers._treePositionDiff(state_from, state_to)>0;
    }

    static isOuterStateOf(state_from, state_to) {
        return FSMHelpers._treePositionDiff(state_from, state_to)<0;
    }

    static _treePositionDiff(state_a, state_b) {
        var share_parent = false,
            level = 0,
            parent = state_b._parent._parent;

        if(state_a._parent._parent._id == parent._id) {
            return 0; // same level
        }

        level = 0;
        while(true) {
            level += 1;
            if( state_a._parent._parent._id == parent._id ) {
                return level; // state_b shares parent with state_a, but is deeper level
            }else if (parent instanceof type.UMLStateMachine) {
                break;
            }
            parent = parent._parent._parent;
        }
        return -1;
    }

    static getCompositeRegionsBetween(state_a, state_b) {
        // find the regions of compiste statemachines when transtion from state_a to state_b is done
        var _state = state_b,
            _regions = [];

        while(FSMHelpers.isCompositeState(FSMHelpers.getParent(_state)) ) {
            if( FSMHelpers.getParent(state_a)._id == FSMHelpers.getParent(_state)._id) {
                break;
            }
            _regions.push(FSMHelpers.getRegion(_state));
            _state = FSMHelpers.getParent(_state);
        }
        return _regions;
    }

    static getCompositeStatesBetween(state_a, state_b) {
        // find the statemachine (statemachines or composite states) when transtion from state_a to state_b is done
        var _state = state_b,
            sms = [];

        while(FSMHelpers.isCompositeState(FSMHelpers.getParent(_state)) ) {
            if( FSMHelpers.getParent(state_a)._id == FSMHelpers.getParent(_state)._id) {
                break;
            }
            _state = FSMHelpers.getParent(_state);
            sms.push(_state);
        }
        return sms;
    }

    static haveSameParent(a_state,b_state) {
        return a_state._parent._parent._id === b_state._parent._id;
    }

}

exports.FSMHelpers = FSMHelpers

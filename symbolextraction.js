
const Dataset = require('./dataset');
/*
For python expecting a Trig and Timeron class like this:

class Trig:
    def __init__(self):
        self._previous:bool = False
        self.Q:bool = False
    
    def tick(self, IN:bool)->bool:
        self.Q = IN is True and self._previous is False
        self._previous = IN
        return self.Q  
        
    def isTriggered(self)->bool:
        return self.Q
            
class Timeron(Trig):
    def __init__(self):
        Trig.__init__(self)
        self._timeout = None
        self._started:bool = False
        
    def start(self, timeout):
        self._timeout = now()+timeout
        self._started = True
        
    def stop(self):
        self._started = False
        
    def tick(self):
        if Trig.tick(self, self._started and now() >= self._timeout) is True:
            self._started = False


*/
const Functions = { 
    SET        : { 'st':'$0:=TRUE',                                 'py':'self.$0=True'},
    RESET      : { 'st':'$0:=FALSE',                                'py':'self.$0=False'},
    PUT        : { 'st':'$0:=$1',                                   'py':'self.$0=$1'},
    TEST       : { 'st':'rt$0(CLK:=FALSE)',                         'py':'self.rt$0.tick(False)'},
    GET        : { 'st':'$0',                                       'py':'self.$0'},
    LGET       : { 'st':'$0',                                       'py':'self.$0'},
    STARTTIMER : { 'st':'ton$event(PT:=DINT_TO_TIME($1),IN:=TRUE)', 'py':'self.ton$event.start($1)'},
    CANCELTIMER: { 'st':'ton$event(IN:=FALSE)',                     'py':'self.ton$event.stop()'},
    ISSET      : { 'st':'$0=TRUE',                                  'py':'self.$0 is True'},
    ISRESET    : { 'st':'$0=FALSE',                                 'py':'self.$0 is False'},

    EVENTTICK  : { 'st':'rt$event(CLK:=$event)',                    'py':'self.rt$event.tick(self.$event)'},
    ISEVENT    : { 'st':'rt$event.Q',                               'py':'self.rt$event.isTriggered()'},

    TIMERTICK  : { 'st':'ton$event()',                              'py':'self.ton$event.tick()'},
    ISTIMEREVENT : { 'st':'ton$event.Q',                            'py':'self.ton$event.isTriggered()'}
};

const DataTypes = { 
    BOOL       : { 'st':'BOOL',   'py':'bool'},
    WORD       : { 'st':'DINT',   'py':'int'},
    TIMER      : { 'st':'TON',    'py':'Timeron'},
    TRIG       : { 'st':'R_TRIG', 'py':'Trig'}
};



function parseEvent( expr, existingVars, target ) {
    var dataset = new Dataset.Dataset();
    eventname = expr.trim().replaceAll(' ','_');
    // check if event allready parsed
    let found=false;
    existingVars.forEach(element => {
                if (element.name === "ton"+eventname) {
                    found=true;
                }
            });
    // there is a difference with timer events and other events
    if (found) {
        dataset.addReplacement(expr,Functions.ISTIMEREVENT[target].replaceAll('$event',eventname) );
    } else if (eventname.length > 0) {
        dataset.addVar(new Dataset.Variable(eventname, DataTypes.BOOL[target], Dataset.Location.VarIn));
        dataset.addVar(new Dataset.Variable("rt"+eventname, DataTypes.TRIG[target], Dataset.Location.Var));
        dataset.addBody(Functions.EVENTTICK[target].replaceAll('$event',eventname));
        dataset.addReplacement(expr, Functions.ISEVENT[target].replaceAll('$event',eventname));
    }
    return dataset;
}

function findExpression( expr ) {
    var exprStart = -1;
    var exprEnd = -1;
    // console.log("Searching:"+expr);
    var validstart=false;
    var startpos = expr.indexOf("(");
    while (startpos>0 && validstart==false) {
        exprStart=startpos-1;
        while (exprStart>0 && expr[exprStart].match(/[a-z]/i)) { 
            exprStart--
        };
        if (expr[exprStart].match(/[a-z]/i)==null) exprStart++;

        if ((startpos - exprStart) >2) {
            validstart=true;
        } else {
            startpos = expr.indexOf("(",startpos+1);
        }
    }

    if (startpos>0) {
        // find closing bracket
        var nrbrackets = 1;
        exprEnd = startpos+1;
        while (exprEnd < expr.length && nrbrackets>0) {
            if (expr[exprEnd] === "(") { nrbrackets++ }
            else if (expr[exprEnd] === ")") { nrbrackets-- }
            exprEnd++;
        };
    };
    return [exprStart,exprEnd];
}


function splitFunctionArgs( expr, target) {
    var dataset = new Dataset.Dataset();

    var fn = "";
    var args = [expr.trim()];
    var newExpr = expr;
    startpos = expr.indexOf("(");
    endpos = expr.lastIndexOf(")");
    if (startpos > 0 && endpos > startpos) {
        newExpr = '';
        fn = expr.substring(0,startpos).trim().toUpperCase();
        args = []; // clear the list
        var localargs = expr.substring(startpos+1,endpos).trim().split(',');
        if (localargs.length > 0) {
            // parse the args to check for functions
            localargs.forEach( arg => {
                var localnewexpr='';
                var remainder = arg;
                while (remainder.length > 0) {
                    var subexprpos = findExpression(remainder);
            
                    if (subexprpos[0]>=0) {
                        localnewexpr += remainder.substring(0,subexprpos[0]);
                        // console.log("reworking: "+remainder.substring(subexprpos[0],subexprpos[1]))
                        dataset.merge( splitFunctionArgs(remainder.substring(subexprpos[0],subexprpos[1]),target));
                        // console.log("into:"+subdataset.newexpr);
                        localnewexpr += dataset.replacements["newexpr"];
                        remainder = remainder.substring(subexprpos[1]);
                    } else {
                        // console.log("No function in:"+remainder);
                        localnewexpr += remainder;
                        remainder = '';
                    }
                }
                args.push( localnewexpr );

                // dataset.merge( splitFunctionArgs(arg) );
                // args.push( dataset.replacements["newexpr"] );
            })
        }
        // console.log("Parsing:"+fn+" args:"+args);
        var eventname = '';
        if (args.length >0) {
            eventname = args[0].trim().replaceAll(' ','_');
        }

        var functemplate = fn;
        if (Functions.hasOwnProperty(fn)) {
            functemplate =Functions[fn][target];

            if (functemplate.search(/\$0/) >= 0) {
                functemplate = functemplate.replace('$0', args[0])
            }
            if (functemplate.search(/\$1/) >= 0) {
                functemplate = functemplate.replace('$1', args[1])
            }
            if (functemplate.search(/\$event/) >= 0) {
                functemplate = functemplate.replace('$event', eventname)
            }
        };

        switch(fn) {
            case 'SET':
                dataset.addVar(new Dataset.Variable(args[0], DataTypes.BOOL[target], Dataset.Location.VarOut));
                newExpr = functemplate;
                break;
            case 'RESET':
                dataset.addVar(new Dataset.Variable(args[0], DataTypes.BOOL[target], Dataset.Location.VarOut));
                newExpr = functemplate;
                break;
            case 'PUT':
                dataset.addVar(new Dataset.Variable(args[0], DataTypes.WORD[target], Dataset.Location.VarOut));
                newExpr = functemplate;
                break;
            case 'TEST':
                newExpr = functemplate;
                break;
            case 'GET':
                dataset.addVar(new Dataset.Variable(args[0], DataTypes.WORD[target], Dataset.Location.VarIn));
                newExpr = functemplate;
                break;
            case 'LGET':
                dataset.addVar(new Dataset.Variable(args[0], DataTypes.WORD[target], Dataset.Location.VarOut));
                newExpr = functemplate;
                break;
            case 'STARTTIMER':
                dataset.addVar(new Dataset.Variable("ton"+eventname, DataTypes.TIMER[target], Dataset.Location.Var));
                dataset.addBody(Functions.TIMERTICK[target].replaceAll('$event',eventname));
                newExpr = functemplate;
                break;
            case 'CANCELTIMER':
                newExpr = functemplate;
                break;
            case 'ISSET':
                dataset.addVar(new Dataset.Variable(args[0], DataTypes.BOOL[target], Dataset.Location.VarIn));
                newExpr = functemplate;
                break;
            case 'ISRESET':
                dataset.addVar(new Dataset.Variable(args[0], DataTypes.BOOL[target], Dataset.Location.VarIn));
                newExpr = functemplate;
                break;
            default:
                newExpr = expr ;
        }
        //console.log("Result:"+dataset.newexpr);


    }
    dataset.addReplacement('newexpr', newExpr );
    return dataset;
}

function parseActivity( expr, target ) {
    // split in function and arguments (where arguments can be functions again)
    var dataset = splitFunctionArgs(expr, target);
    dataset.addReplacement(expr, dataset.replacements["newexpr"]);
    dataset.replacements['newexpr'] =''; // remove this temp replacement
    return dataset;
}

function parseGuard( expr, target ) {
    var dataset = new Dataset.Dataset();
    // guards can be a combination of guards, combined by && or ||
    var newexpr = "";
    var remainder = expr;

    // console.log("starting with:"+remainder);
    while (remainder.length > 0) {
        var subexprpos = findExpression(remainder);

        if (subexprpos[0]>=0) {
            newexpr += remainder.substring(0,subexprpos[0]);
            // console.log("reworking: "+remainder.substring(subexprpos[0],subexprpos[1]))
            dataset.merge( splitFunctionArgs(remainder.substring(subexprpos[0],subexprpos[1]),target));
            // console.log("into:"+subdataset.newexpr);
            newexpr += dataset.replacements["newexpr"];
            remainder = remainder.substring(subexprpos[1]);
        } else {
            // console.log("No function in:"+remainder);
            newexpr += remainder;
            remainder = '';
        }
    }

    newexpr = newexpr.replaceAll("&&", " AND ");
    newexpr = newexpr.replaceAll("||", " OR ");

    dataset.addReplacement(expr, newexpr);
    dataset.replacements['newexpr'] =''; // remove this temp replacement
    return dataset;
}


function extract(element, target) {

    if (target != 'st' && target != 'py') {
        target = 'st'
    }
    
    var transitions =[];
    app.repository.select('@UMLTransition').forEach(transition => {
        if(transition._parent._parent._id === element._id) {
            transitions.push(transition);
        }
    });

    var dataset = new Dataset.Dataset();
    var _used_states= [];

    transitions.forEach( transition => {
        dataset.merge( parseGuard( transition.guard, target) );

        transition.effects.forEach(effect => {
            dataset.merge( parseActivity( effect.name, target) );
        });
        _used_states.push(transition.source);
        _used_states.push(transition.target);
    })

    _used_states = Array.from(new Set(_used_states));
    _used_states.forEach(state => {
        if (!(state instanceof type['UMLPseudostate'])) {

            state.entryActivities.forEach(entry => {
                dataset.merge( parseActivity( entry.name, target) );
            });

            state.exitActivities.forEach(exit => {
                dataset.merge( parseActivity( exit.name, target) );
            });
        };
    });

    transitions.forEach( transition => {
        if (transition.triggers.length > 0) {
            dataset.merge( parseEvent( transition.triggers[0].name, dataset.var_private, target ) );
        }
    })

    return dataset;
}

exports.extract = extract
exports.parseEvent = parseEvent
exports.parseActivity = parseActivity
exports.parseGuard = parseGuard


const Dataset = require('./dataset');


function parseEvent( expr, existingVars ) {
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
        dataset.addReplacement(expr,"ton"+eventname+".Q");
    } else if (eventname.length > 0) {
        dataset.addVar(new Dataset.Variable(eventname, 'BOOL', Dataset.Location.VarIn));
        dataset.addVar(new Dataset.Variable("rt"+eventname, 'R_TRIG', Dataset.Location.Var));
        dataset.addBody("rt"+eventname+"(CLK:="+eventname+")");
        dataset.addReplacement(expr, "rt"+eventname+".Q");
    }
    return dataset;
}

function findExpression( expr ) {
    var exprStart = -1;
    var exprEnd = -1;
    const allowedChars = [' ', '(', '+', '-'];
    // console.log("Searching:"+expr);
    var validstart=false;
    var startpos = expr.indexOf("(");
    while (startpos>0 && validstart==false) {
        exprStart=startpos-1;
        while (exprStart>0 && allowedChars.includes(expr[exprStart] )==false ) {
            exprStart--
        };
        if (allowedChars.includes(expr[exprStart])==true) exprStart++;

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


function splitFunctionArgs( expr) {
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
                        dataset.merge( splitFunctionArgs(remainder.substring(subexprpos[0],subexprpos[1])));
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
        switch(fn) {
            case 'SET':
                dataset.addVar(new Dataset.Variable(args[0], 'BOOL', Dataset.Location.VarOut));
                newExpr = args[0]+":=TRUE";
                break;
            case 'RESET':
                dataset.addVar(new Dataset.Variable(args[0], 'BOOL', Dataset.Location.VarOut));
                newExpr = args[0]+":=FALSE";
                break;
            case 'PUT':
                dataset.addVar(new Dataset.Variable(args[0], 'DINT', Dataset.Location.VarOut));
                newExpr = args[0]+":="+args[1];
                break;
            case 'TEST':
                newExpr = "rt"+args[0]+"(CLK:=FALSE)";
                break;
            case 'GET':
                dataset.addVar(new Dataset.Variable(args[0], 'DINT', Dataset.Location.VarIn));
                newExpr = args[0];
                break;
            case 'STARTTIMER':
                var timername = args[0].trim().replaceAll(' ','_');
                dataset.addVar(new Dataset.Variable("ton"+timername, 'TON', Dataset.Location.Var));
                dataset.addBody("ton"+timername+"()");
                newExpr = "ton"+timername+"(PT:=DINT_TO_TIME("+args[1]+"),IN:=TRUE)";
                break;
            case 'CANCELTIMER':
                var timername = args[0].trim().replaceAll(' ','_');
                newExpr = "ton"+timername+"(IN:=FALSE)";
                break;
            case 'ISSET':
                dataset.addVar(new Dataset.Variable(args[0], 'BOOL', Dataset.Location.VarIn));
                newExpr = args[0]+"=TRUE";
                break;
            case 'ISRESET':
                dataset.addVar(new Dataset.Variable(args[0], 'BOOL', Dataset.Location.VarIn));
                newExpr = args[0]+"=FALSE";
                break;
            default:
                newExpr = expr ;
        }
        //console.log("Result:"+dataset.newexpr);


    }
    dataset.addReplacement('newexpr', newExpr );
    return dataset;
}

function parseActivity( expr ) {
    // split in function and arguments (where arguments can be functions again)
    var dataset = splitFunctionArgs(expr);
    dataset.addReplacement(expr, dataset.replacements["newexpr"]);
    dataset.replacements['newexpr'] =''; // remove this temp replacement
    return dataset;
}

function parseGuard( expr ) {
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
            dataset.merge( splitFunctionArgs(remainder.substring(subexprpos[0],subexprpos[1])));
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


function extract(element) {
    var transitions =[];
    app.repository.select('@UMLTransition').forEach(transition => {
        if(transition._parent._parent._id === element._id) {
            transitions.push(transition);
        }
    });

    var dataset = new Dataset.Dataset();
    var _used_states= [];

    transitions.forEach( transition => {
        dataset.merge( parseGuard( transition.guard) );

        transition.effects.forEach(effect => {
            dataset.merge( parseActivity( effect.name) );
        });
        _used_states.push(transition.source);
        _used_states.push(transition.target);
    })

    _used_states = Array.from(new Set(_used_states));
    _used_states.forEach(state => {
        if (!(state instanceof type['UMLPseudostate'])) {

            state.entryActivities.forEach(entry => {
                dataset.merge( parseActivity( entry.name) );
            });

            state.exitActivities.forEach(exit => {
                dataset.merge( parseActivity( exit.name) );
            });
        };
    });

    transitions.forEach( transition => {
        if (transition.triggers.length > 0) {
            dataset.merge( parseEvent( transition.triggers[0].name, dataset.var_private ) );
        }
    })

    return dataset;
}

exports.extract = extract
exports.parseEvent = parseEvent
exports.parseActivity = parseActivity
exports.parseGuard = parseGuard

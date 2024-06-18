
const Dataset = require('./dataset');


function extractvars(dataset) {
    var varslist = [];
    dataset.var_in.forEach(item => {
        varslist.push(item.varname);
    })
    dataset.var_out.forEach(item => {
        varslist.push(item.varname);
    })
    dataset.var_inout.forEach(item => {
        varslist.push(item.varname);
    })
    dataset.var_private.forEach(item => {
        varslist.push(item.varname);
    })
    return varslist;
}

function parseEvent( expr, existingvars ) {
    var dataset = new Dataset.Dataset();
    eventname = expr.trim();
    // check if event allready parsed
    // there is a difference with timer events and other events
    if (eventname.startsWith("ev") && eventname.endsWith("Timeout")) {
        timername = eventname.slice(2,-7);
        if (existingvars.includes("ton"+timername) == false)
        {
            dataset.addVar(new Dataset.Variable("ton"+timername, 'TON', Dataset.Location.Var));
            dataset.addBody("ton"+timername+"()");
            dataset.addReplacement(expr,"ton"+timername+".Q");
        };
    } else if (eventname.length > 0) {
        if (existingvars.includes(eventname) == false) {
            dataset.addVar(new Dataset.Variable(eventname, 'BOOL', Dataset.Location.VarIn));
            dataset.addVar(new Dataset.Variable("rt"+eventname, 'R_TRIG', Dataset.Location.Var));
            dataset.addBody("rt"+eventname+"(CLK:="+eventname+")");
            dataset.addReplacement(expr, eventname+".Q");
        };
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
        while (exprStart>0 && expr[exprStart]!=' ' && expr[exprStart]!='(' ) {
            exprStart--
        };
        if (expr[exprStart]==' ' || expr[exprStart]=='(') exprStart++;

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
        localargs = expr.substring(startpos+1,endpos).trim().split(',');
        if (localargs.length > 0) {
            // parse the args to check for functions
            localargs.forEach( arg => {
                dataset.merge( splitFunctionArgs(arg) );
                args.push( dataset.replacements["newexpr"] );
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
                newExpr = "IF rt"+args[0]+".CLK = TRUE THEN rt"+args[0]+"(CLK:= FALSE); END_IF";
                break;
            case 'GET':
                dataset.addVar(new Dataset.Variable(args[0], 'DINT', Dataset.Location.VarIn));
                newExpr = args[0];
                break;
            case 'STARTTIMER':
                newExpr = "ton"+args[0]+"(PT:=DINT_TO_TIME("+args[1]+"),IN:=TRUE)";
                break;
            case 'CANCELTIMER':
                newExpr = "ton"+args[0]+"(IN:=FALSE)";
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
    var createdvars = []; // array of created var names

    element.regions[0].vertices.forEach(state => {
        if (!(state instanceof type['UMLPseudostate'])) {
    
            state.entryActivities.forEach(entry => {
                dataset.merge( parseActivity( entry.name) );
            });
            
            state.exitActivities.forEach(exit => {
                dataset.merge( parseActivity( exit.name) );
            });
        };
    });
    

    createdvars = extractvars(dataset);
    transitions.forEach( transition => {
        if (transition.triggers.length > 0) {
            dataset.merge( parseEvent( transition.triggers[0].name, createdvars) );
            createdvars = extractvars(dataset);
        }
        dataset.merge( parseGuard( transition.guard) );

        transition.effects.forEach(effect => {
            dataset.merge( parseActivity( effect.name) );
        });
    })
    
    return dataset;
}

exports.extract = extract
exports.parseEvent = parseEvent
exports.parseActivity = parseActivity
exports.parseGuard = parseGuard
exports.extractvars = extractvars

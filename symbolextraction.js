

function showdataset(dataset) {
    dataset.vars.forEach(value => { console.log("VAR:"+value.varname) });
    dataset.fbs.forEach(value => { console.log("FB:"+value) });
    for(const [from, to] of Object.entries(dataset.repl)) { console.log("REPL:"+from+" to "+to) }
}

function createdataset(dataset) {
    var extendeddataset = { var_in:[], 
                    var_out:[], 
                    var_private:[], 
                    var_inout:[], 
                    body_pre:dataset.fbs,
                    replacements:{} };

    dataset.vars.forEach( item => {
        if (item.location == "INPUT") {
            extendeddataset.var_in.push(item.varname+" : "+item.datatype);
        }
        if (item.location == "OUTPUT") {
            extendeddataset.var_out.push(item.varname+" : "+item.datatype);
        }
        if (item.location == "VAR") {
            extendeddataset.var_private.push(item.varname+" : "+item.datatype);
        }
        if (item.location == "IN_OUT") {
            extendeddataset.var_inout.push(item.varname+" : "+item.datatype);
        }
    })

    dataset.fbs.forEach( item => {
        if (item != "") {
            extendeddataset.body_pre.push(item);
        }
    })

    for(let [from, to] of Object.entries(dataset.repl)) {
        if (from != to && from != "") {
            extendeddataset.replacements[from] = to; 
        }
    }

    return extendeddataset;
}

function mergedatasets(sourceset, mergeset) {
    var dataset = sourceset;

    dataset.fbs = sourceset.fbs.concat(mergeset.fbs);
    dataset.fbs = dataset.fbs.filter((item,pos) => dataset.fbs.indexOf(item) === pos) // make unique

    dataset.repl = Object.assign({}, sourceset.repl ,mergeset.repl);

    mergeset.vars.forEach(item => {
        var exists=false;
        dataset.vars.forEach( source_item => {
            if (source_item.varname == item.varname) {
                exists=true;
                if (source_item.location != item.location) {
                    source_item.location = "IN_OUT";
                }
            }
        })
        if (exists==false) {
            dataset.vars.push(item);
        }
    })

    return dataset;
}

function parseEvent( expr ) {
    var dataset = { vars:[], fbs:[], repl:{} };
    eventname = expr.trim();
    // check if event allready parsed
    // there is a difference with timer events and other events
    if (eventname.startsWith("ev") && eventname.endsWith("Timeout")) {
        timername = eventname.slice(2,-7);
        dataset.vars.push( {varname:"ton"+timername, location:'VAR', datatype:'TON'});
        dataset.fbs.push("ton"+timername+"()");
        dataset.repl[eventname] ="ton"+timername+".Q";
    } else {
        dataset.vars.push( {varname:eventname, location:'INPUT', datatype:'BOOL'});
        dataset.vars.push( { varname:"rt"+eventname, location:'VAR', datatype:'R_TRIG'});
        dataset.fbs.push("rt"+eventname+"(CLK:="+eventname+")");
        dataset.repl[eventname] =eventname+".Q";
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
    var dataset = { newexpr: expr, vars:[], fbs:[], repl:{} };

    var fn = "";
    var args = [expr.trim()];
    startpos = expr.indexOf("(");
    endpos = expr.lastIndexOf(")");
    if (startpos > 0 && endpos > startpos) {
        dataset.newexpr = "";
        fn = expr.substring(0,startpos).trim().toUpperCase();
        args = []; // clear the list
        localargs = expr.substring(startpos+1,endpos).trim().split(',');
        if (localargs.length > 0) {
            // parse the args to check for functions
            localargs.forEach( arg => {
                subdataset = splitFunctionArgs(arg);
                dataset = mergedatasets(dataset, subdataset);
                args.push( subdataset.newexpr );
            })
        }
        //console.log("Parsing:"+fn+" args:"+args);
        switch(fn) {
            case 'SET':
                dataset.vars.push( {varname:args[0], location:'OUTPUT', datatype:'BOOL'});
                dataset.newexpr = args[0]+":=TRUE";
                break;
            case 'RESET':
                dataset.vars.push( {varname:args[0], location:'OUTPUT', datatype:'BOOL'});
                dataset.newexpr = args[0]+":=FALSE";
                break;
            case 'PUT':
                dataset.vars.push( {varname:args[0], location:'OUTPUT', datatype:'DINT'});
                dataset.newexpr = args[0]+":="+args[1];
                break;
            case 'TEST':
                dataset.newexpr = "IF "+args[0]+" = "+args[1]+" THEN rt"+args[0]+"(CLK:= NOT "+args[1]+") END_IF";
                break;
            case 'GET':
                dataset.vars.push( {varname:args[0], location:'INPUT', datatype:'DINT'});
                dataset.newexpr = args[0];
                break;
            case 'STARTTIMER':
                dataset.newexpr = "ton"+args[0]+"(PT:="+args[1]+",IN:=TRUE)";
                break;
            case 'CANCELTIMER':
                dataset.newexpr = "ton"+args[0]+"(IN:=FALSE)";
                break;
            case 'ISSET':
                dataset.newexpr = args[0]+"=TRUE";
                break;
            case 'ISRESET':
                dataset.newexpr = args[0]+"=FALSE";
                break;
            default:
                dataset.newexpr = expr;
        }
        //console.log("Result:"+dataset.newexpr);
    

    }
    return dataset;
}

function parseActivity( expr ) {
    // split in function and arguments (where arguments can be functions again)
    var dataset = splitFunctionArgs(expr);
    dataset.repl[expr] = dataset.newexpr;
    return dataset;
}

function parseGuard( expr ) {
    var dataset = { vars:[], fbs:[], repl:{} };
    // guards can be a combination of guards, combined by && or ||
    var newexpr = "";
    var remainder = expr;

    // console.log("starting with:"+remainder);
    while (remainder.length > 0) {
        var subexprpos = findExpression(remainder);

        if (subexprpos[0]>=0) {
            newexpr += remainder.substring(0,subexprpos[0]);
            // console.log("reworking: "+remainder.substring(subexprpos[0],subexprpos[1]))
            subdataset = splitFunctionArgs(remainder.substring(subexprpos[0],subexprpos[1]));
            dataset = mergedatasets(dataset, subdataset);
            // console.log("into:"+subdataset.newexpr);
            newexpr += subdataset.newexpr;
            remainder = remainder.substring(subexprpos[1]);    
        } else {
            // console.log("No function in:"+remainder);
            newexpr += remainder;
            remainder = '';
        }
    }

    newexpr = newexpr.replaceAll("&&", " AND ");
    newexpr = newexpr.replaceAll("||", " OR ");

    dataset.repl[expr] =newexpr;
    return dataset;
}


function extract(element) {
    var transitions =[];
    app.repository.select('@UMLTransition').forEach(transition => {
        if(transition._parent._parent._id === element._id) {
            transitions.push(transition);
        }
    });

    var dataset = { vars:[], fbs:[], repl:{} };

    element.regions[0].vertices.forEach(state => {
        if (!(state instanceof type['UMLPseudostate'])) {
    
            state.entryActivities.forEach(entry => {
                subdataset = parseActivity( entry.name);
                dataset = mergedatasets(dataset, subdataset);
            });
            
            state.exitActivities.forEach(exit => {
                subdataset = parseActivity( exit.name);
                dataset = mergedatasets(dataset, subdataset);
            });
        };
    });
    

    transitions.forEach( transition => {
        if (transition.triggers.length > 0) {
            subdataset = parseEvent( transition.triggers[0].name);
            dataset = mergedatasets(dataset, subdataset);
        }
        subdataset = parseGuard( transition.guard);
        dataset = mergedatasets(dataset, subdataset);

        transition.effects.forEach(effect => {
            subdataset = parseActivity( effect.name);
            dataset = mergedatasets(dataset, subdataset);
        });
    })
    
    var composeddataset = createdataset(dataset);
    return composeddataset;
}

exports.extract = extract
exports.parseEvent = parseEvent
exports.parseActivity = parseActivity
exports.parseGuard = parseGuard
exports.mergedatasets = mergedatasets
exports.createdataset = createdataset
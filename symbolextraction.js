
VARS = [];
FUNCTION_BLOCKS = [];
REPLACEMENTS = {};


function createdataset() {
    var dataset = { var_in:[], 
                    var_out:[], 
                    var_private:[], 
                    var_inout:[], 
                    body_pre:FUNCTION_BLOCKS,
                    replacements:REPLACEMENTS };

    VARS.forEach( item => {
        if (item.type == "INPUT") {
            dataset.var_in.push(item.name+" : "+item.datatype+";");
        }
        if (item.type == "OUTPUT") {
            dataset.var_out.push(item.name+" : "+item.datatype+";");
        }
        if (item.type == "VAR") {
            dataset.var_private.push(item.name+" : "+item.datatype+";");
        }
        if (item.type == "IN_OUT") {
            dataset.var_inout.push(item.name+" : "+item.datatype+";");
        }
    })
    return dataset;
}

function addvar( name, type, datatype) {
    exists=false;
    VARS.forEach( item => { 
        if (item.name == name) {
            exists=true;
            if (item.type != type && item.type != "IN_OUT") {
                item.type = "IN_OUT";
            };
            if(item.datatype != datatype) {
                console.error("Conflicting datatype for VAR "+name+": "+datatype+" and "+item.datatype);
            }
        }
    })

    if (exists == false) {
        VARS.push( {name:name, type:type, datatype:datatype});
    }
    return exists;
}

function addfb( fb ) {
    exists=FUNCTION_BLOCKS.indexOf(fb)>=0;
    if (exists == false) {
        FUNCTION_BLOCKS.push( fb );
    }
    return exists;
}

function addreplacement( from, to ) {
    exists=false;
    if (from in REPLACEMENTS) {
        exists=true;
        if (REPLACEMENTS[from] != to) {
            console.error("Conflicting datatype for replacement ["+from+"]: ["+to+"] and ["+REPLACEMENTS[from]+"]");
        }
    } else {
        REPLACEMENTS[from] = to;
    }
    return exists;
}

function parseEvent( expr ) {
    eventname = expr.trim();
    // check if event allready parsed
    // there is a difference with timer events and other events
    if (eventname.startsWith("ev") && eventname.endsWith("Timeout")) {
        timername = eventname.slice(2,-7);
        if (addvar( name="ton"+timername, type='VAR', datatype='TON') == false) {
            addfb("ton"+timername+"();");
            addreplacement(from=eventname, to="ton"+timername+".Q");
        };
    } else {
        if (addvar( name=eventname, type='INPUT', datatype='BOOL') == false) {
            addvar( name="rt"+eventname, type='VAR', datatype='R_TRIG');
            addfb("rt"+eventname+"(CLK:="+eventname+");");
            addreplacement(from=eventname, to=eventname+".Q");
        }
    }
}

function splitFunctionArgs( expr) {
    newexpr = expr;
    var fn = "";
    var args = [expr.trim()];
    startpos = expr.indexOf("(");
    endpos = expr.lastIndexOf(")");
    if (startpos > 0 && endpos > startpos) {
        newexpr = "";
        fn = expr.substring(0,startpos).trim().toUpperCase();
        args = []; // clear the list
        localargs = expr.substring(startpos+1,endpos).trim().split(',');
        if (localargs.length > 0) {
            // parse the args to check for functions
            localargs.forEach( arg => {
                args.push( splitFunctionArgs(arg) );
            })
        }
        //console.log("Parsing:"+fn+" args:"+args);
        switch(fn) {
            case 'SET':
                addvar( name=args[0], type='OUTPUT', datatype='BOOL');
                newexpr = args[0]+":=TRUE";
                break;
            case 'RESET':
                addvar( name=args[0], type='OUTPUT', datatype='BOOL');
                newexpr = args[0]+":=FALSE";
                break;
            case 'PUT':
                addvar( name=args[0], type='OUTPUT', datatype='DINT');
                newexpr = args[0]+":="+args[1];
                break;
            case 'TEST':
                newexpr = "IF "+args[0]+" = "+args[1]+" THEN rt"+args[0]+"(CLK:= NOT "+args[1]+") END_IF";
                break;
            case 'GET':
                addvar( name=args[0], type='INPUT', datatype='DINT');
                newexpr = args[0];
                break;
            case 'STARTTIMER':
                newexpr = "ton"+args[0]+"(PT:="+args[1]+",IN:=TRUE)";
                break;
            case 'CANCELTIMER':
                newexpr = "ton"+args[0]+"(IN:=FALSE)";
                break;
            case 'ISSET':
                newexpr = args[0]+"=TRUE";
                break;
            case 'ISRESET':
                newexpr = args[0]+"=FALSE";
                break;
            default:
                newexpr = expr;
        }
        //console.log("Result:"+newexpr);
    

    }
    return newexpr;
}

function parseActivity( expr ) {
    // split in function and arguments (where arguments can be functions again)
    activity = splitFunctionArgs(expr);
    addreplacement(from=expr, to=activity);
}

function parseGuard( expr ) {
    // guards can be a combination of guards, combined by && or ||
    var newexpr = "";
    expr.split("&&").forEach( (subexpr1, idx1) => {
        if (idx1>0) { newexpr += " AND "}
        subexpr1.split("||").forEach( (subexpr2, idx2) => {
            if (idx2>0) { newexpr += " OR "}
            newexpr += splitFunctionArgs(subexpr2);
        })
    });
    addreplacement(from=expr, to=newexpr);
}


function extract(element) {
    var transitions =[],
    dataset = {};
    app.repository.select('@UMLTransition').forEach(transition => {
        if(transition._parent._parent._id === element._id) {
            transitions.push(transition);
        }
    });

    ///
    transitions.forEach( transition => {
        if (transition.triggers.length > 0) {
            parseEvent( transition.triggers[0].name);
        }
        parseGuard( transition.guard);
    })

    return createdataset();
}

exports.extract = extract
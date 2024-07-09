const Location = {
	Var: Symbol("Var"),
	VarIn: Symbol("VarIn"),
	VarOut: Symbol("VarOut"),
    VarInOut: Symbol("VarInOut"),
    VarConst: Symbol("VarConst")
}

class Variable {
    name;
    datatype;
    location;
    comment = '';
    defaultValue = null;
    constructor(name, datatype, location, comment= '', defaultValue=null) {
        this.name = name;
        this.datatype = datatype;
        this.location = location;
        this.comment = comment;
        this.defaultValue = defaultValue;
    }

    isEqual(a_var) {
        return this.name === a_var.name;// && this.datatype === a_var.datatype && this.location === a_var.location;
    }

    isInArray(a_array) {
        let found=false;
        a_array.forEach(element => {
                if (element.isEqual(this)) {
                    found=true;
                }
            });
        return found;
    }

}

function clean_var_array(vars) {
    return vars.reduce((accumulator, currentValue) => (
        (currentValue in ['', null] || currentValue.isInArray(accumulator)) ? accumulator : [...accumulator, currentValue]
    ), []);
}

function remove_from_var_array(vars, var_to_remove) {
    return vars.reduce((accumulator, currentValue) => (
        (currentValue in ['', null] || currentValue.name === var_to_remove) ? accumulator : [...accumulator, currentValue]
    ), []);
}

class Dataset {
    var_private = [];
    var_in = [];
    var_out = [];
    var_inout = [];
    body_pre = [];
    replacements = {};

    cleanData() {
        // make it unique and remove empty variables
        this.var_private = clean_var_array(this.var_private);
        this.var_in = clean_var_array(this.var_in);
        this.var_out = clean_var_array(this.var_out);
        this.var_inout = clean_var_array(this.var_inout);

        this.body_pre = Array.from(new Set(this.body_pre));
    }

    merge(otherset) {
        otherset.body_pre.forEach( item => { this.addBody(item) });
        for(const [from, to] of Object.entries(otherset.replacements)) {
            if (to != '') this.addReplacement(from, to)
        }

        otherset.var_private.forEach( item => { this.addVar( item )});
        otherset.var_in.forEach( item => { this.addVar( item )});
        otherset.var_out.forEach( item => { this.addVar( item )});
        otherset.var_inout.forEach( item => { this.addVar( item )});

        this.cleanData();
    }

    addVar(aVar) {

        let exists=false;
        let existingLoc = aVar.location;

        if (aVar.isInArray(this.var_in)) {
            existingLoc = Location.VarIn;
            exists = true;
        } else if (aVar.isInArray(this.var_out)) {
            existingLoc = Location.VarOut;
            exists = true;
        } else if (aVar.isInArray(this.var_private)) {
            existingLoc = Location.Var;
            exists = true;
        } else if (aVar.isInArray(this.var_inout)) {
            existingLoc = Location.VarInOut;
            exists = true;
        }

        // if it already exists, but with another location, remove it and put it in inout
        if (exists == true && existingLoc != aVar.location && existingLoc != Location.VarInOut) {
            // remove it
            if (existingLoc == Location.VarIn) { this.var_in = remove_from_var_array(this.var_in, aVar.name)}
            if (existingLoc == Location.VarOut) { this.var_out = remove_from_var_array(this.var_out, aVar.name)}
            if (existingLoc == Location.Var) { this.var_private = remove_from_var_array(this.var_private, aVar.name)}

            aVar.location = Location.VarInOut;
            exists = false; // to add it with the new location
        }

        if (exists==false) {
            switch (aVar.location) {
                case Location.VarIn:
                    this.var_in.push(aVar);
                    break;
                case Location.VarOut:
                    this.var_out.push(aVar);
                    break;
                case Location.VarInOut:
                    this.var_inout.push(aVar);
                    break;
                default:
                    this.var_private.push(aVar);
                    break;

            }
        };
    }

    addBody(aBody) {
        if ((aBody in ['', null])==false) {
            this.body_pre.push(aBody);
        }
    }

    addReplacement(from, to) {
        if ((from in ['', null])==false && from != to && (to in ['', null])==false ) {
            this.replacements[from] = to;
        }
    }
}


exports.Location = Location
exports.Variable = Variable
exports.Dataset = Dataset

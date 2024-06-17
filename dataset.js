const Location = {
	Var: Symbol("Var"),
	VarIn: Symbol("VarIn"),
	VarOut: Symbol("VarOut"),
	VarInOut: Symbol("VarInOut")
}

class Variable {
    name;
    datatype;
    location;
    comment = '';
    constructor(name, datatype, location, comment= '') {
        this.name = name;
        this.datatype = datatype;
        this.location = location;
        this.comment = comment;
    }

    isEqual(a_var) {
        return this.name === a_var.name && this.datatype === a_var.datatype && this.location === a_var.location;
    }

    isInArray(a_array) {
        var found = false;
        a_array.forEach(element => {
                found = element.isEqual(this);
                if (found) {
                    return;
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

        this.body_pre = Array.from(Set(this.body_pre));
    }

    addVar(aVar) {
        switch (aVar.Location) {
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
    }
}


exports.Location = Location
exports.Variable = Variable
exports.Dataset = Dataset

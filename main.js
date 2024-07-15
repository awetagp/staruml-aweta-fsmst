// docs : https://docs.staruml.io/developing-extensions
// api: https://files.staruml.io/api-docs/6.0.0/api/index.html

const path = require('path');
const fs = require('fs');
const { ipcRenderer } = require("electron");
const extract = require('./symbolextraction').extract;
const codegenerator = require('./code-generator');
const modelvalidator = require('./model-validator');

const templatePanel = fs.readFileSync(
    path.join(__dirname, "model-validator-panel.html"),
    "utf8"
);

const templateItem = fs.readFileSync(
    path.join(__dirname, "model-validator-item.html"),
    "utf8"
);

var fsmModelValidationPanel,
    listView;
var dataSource = new kendo.data.DataSource();

/**
 * Parse arguments provided to the command, typical comming from cmd-line execute.
 * When not present the arguments are set to default value.
 * @param {String|Object|null|undefined} message
 * @returns {Object}
 */
function parseArgs(message) {
    var _args = {},
        basedir = path.dirname(app.project.filename),
        args = {
            'cli': typeof message != 'undefined', // set when called from the cmd-line
            'showhelp': false,
            'target': app.preferences.get('fsmst.gen.target'),
            'output': path.resolve(path.join(basedir, app.preferences.get('fsmst.gen.outputFormat'))),
            'elements': app.repository.select('@UMLStateMachine')
        };

    if (message) {
        if (typeof message == 'string') {
            message = [message];
        }

        message.forEach(arg => {
            if (arg == 'help' || arg == 'h') {
                showTheUsage = true;
                return;
            }
            if (arg[1] == '=') {
                _args[arg[0]] = arg.substr(2);
            }
        });

        if ('t' in _args) {
            args.target = _args['t'];
        }
        if ('s' in _args) {
            args.elements = app.repository.select(_args['s']);
        }
        if ('o' in _args) {
            args.output = _args['o'];
        }
    } else if (args.cli == false) {
        var diagram = app.diagrams.getCurrentDiagram();
        if (diagram instanceof type.UMLStatechartDiagram) {
            args.elements = [diagram._parent];
        }
        else {
            args.elements = null;
        }

    }

    return args;
}


/**
 * Generator wrapper for code generation
 * @param {Array.UMLStateMachines} statemachines - list of statemachine to generate code for
 * @param {String} output - ejs string template where to put to output
 * @param {String} target - generate code for this target (st|brst|scl)
 * @returns {boolean} true when an error occured
 */
function handleFsmCodeGenerator(statemachines, output, target) {
    var error = false,
        countGenerated = 0;
    const file_extensions = ['.typ', '.fun', '.st'];
    const file_count = target == 'brst' ? 3 : 1;
    if (output) {

        try {
            for (let i = 0; i < statemachines.length; i++) {
                var output_masker = output;
                const element = statemachines[i];

                var validationError = modelvalidator.validate(element).length != 0;
                if (validationError == false) {

                    // if split generate for each file part an own render
                    for (let file_nr = 0; file_nr < file_count; file_nr++) {
                        const dataset = extract(element, target);
                        var options = new codegenerator.StructuredTextGeneratorOptions();
                        const data = {
                            element: element,
                        };
                        options.target = target;
                        options.generateType = file_count === 1 ? true : file_nr === 0,
                            options.generateVars = file_count === 1 ? true : file_nr === 1;
                        options.generateST = file_count === 1 ? true : file_nr === 2;

                        if (file_count > 1) {
                            output_masker = output_masker.replace(/\.\w+$/, file_extensions[file_nr]);
                        }
                        else if (target == 'scl') {
                            output_masker = output_masker.replace(/\.\w+$/, '.scl');
                        }
                        else if (target == 'py') {
                            output_masker = output_masker.replace(/\.\w+$/, '.py');
                        }

                        const outputRendered = ejs.render(output_masker, data, { async: false });
                        console.log(outputRendered);
                        var rendered = '',
                            basedir = '';

                        rendered = codegenerator.generate(element, basedir, dataset, options);

                        if (error == false) {
                            console.log(`gen done`);
                            fs.writeFileSync(outputRendered, rendered, { encoding: "utf-8" });
                            console.log(`writen to ${outputRendered}`);
                            ipcRenderer.send("console-log", `[StarUML|FSM_ST] Generated '${outputRendered}'`);
                        }
                        countGenerated += 1;
                    }
                } else {
                    ipcRenderer.send("console-log", `[StarUML|FSM_ST] Oeps validation errors with '${element.name}', skip code generation.`);
                }

            }
            ipcRenderer.send(
                "console-log",
                `[StarUML|FSM_ST] Total ${countGenerated}/${statemachines.length} statemachine(s) were generated`,
            );

        } catch (err) {
            ipcRenderer.send("console-log", `[FSM_ST|Error] ${err.toString()}`);
            console.error(err);
            error = true;
        }


    }
    return error;
}

/**
 * Called when the StarUML cmd 'fsm_st:generate' is executed.
 * Can be called from gui and from command-line.
 * @param {Object|undefined|null} message
 */
function handleFsmGenerate(message) {
    var args = parseArgs(message);


    if (args.cli) {
        if (args.showhelp) {
            showUsage();
            return;
        } else if (!args.elements || args.elements.length == 0)  {
            ipcRenderer.send("console-log", "Invalid arguments!");
            showUsage();
            return;
        }

        error = handleFsmCodeGenerator(args.elements, args.output, args.target);
        ipcRenderer.send("console-log", "Done it!");
    } else {

        // helper when cmd is execute by the gui; shows some additional message boxes.
        function _do_generate(sm) {
            var  error;

            var validationError = modelvalidator.validate(sm).length != 0;
            if (validationError == false) {
                error = handleFsmCodeGenerator([sm], args.output, args.target);
                if (error == false) {
                    if (app.preferences.get("fsmst.gen.showComplete")) {
                        app.dialogs.showInfoDialog(`Complete code generation for statemachine '${sm.name}'.`);
                    }
                } else {
                    app.dialogs.showAlertDialog(`An fatal error occured during code generation for statemachine '${sm.name}'.`);
                }
            } else {
                handleFsmModelValidate();
                app.dialogs.showAlertDialog(`StateMachine model isn't valid, please check validation errors for statemachine '${sm.name}'.`);
            }
        }

        if (args.elements) {
            _do_generate(args.elements[0]);
        }
        else {
            app.elementPickerDialog.showDialog('Select a statemachine model to generate code for', null, type.UMLStateMachine).then(function ({
                buttonId,
                returnValue
            }) {
                if (buttonId === 'ok') {
                    if (returnValue instanceof type['UMLStateMachine']) {
                        _do_generate(returnValue);
                    } else {
                        app.dialogs.showInfoDialog('Please select a StateMachine!');
                    }
                };
            });
        }

    }
}

/**
 * Validate a statemachine and shows the errors
 * @param {UMLStateMachine} sm - the statemachine to validate
 * @param {boolean} cli - true if running from command-line
 * @returns
 */
function _do_validate(sm, cli) {
    ipcRenderer.send("console-log", `[FSM Validation] Validating statemachine '${sm.name}'`);
    var errors = modelvalidator.validate(sm);

    if (cli) {
        errors.forEach(_error => {
            var elem = _error.element,
                msg = _error.msg;

            ipcRenderer.send("console-log", `[FSM Validation Error] [${elem.getClassName()}] ${elem.name||'-'} - ${msg}`);
        });
    }  else {
        errors.forEach(_error => {
            var elem = _error.element,
                msg = _error.msg;
            dataSource.add({
                id: elem._id,
                icon: elem.getNodeIcon(),
                name: elem.name,
                type: elem.getClassName(),
                msg: msg
            });
        });
    }
    return errors;
}

/**
 * Called when the StarUML cmd 'fsm_st:validate' is executed.
 * Can be called from gui and from command-line.
 * @param {Object|undefined|null} message
 */
function handleFsmModelValidate(message) {
    var args = parseArgs(message),
        statemachines = args.elements;

    dataSource.data([]); // clear validation messages

    if (statemachines) {
        var errors=[]
        statemachines.forEach(statemachine => {
            errors.push(..._do_validate(statemachine, args.cli));
        });
        if (errors.length > 0) {
            ipcRenderer.send("console-log", `[FSM Validation] A total of ${errors.length} errors found.`);
        }
        else {
            ipcRenderer.send("console-log", `[FSM Validation] No errors found.`);
        }
    }
    else {
        app.elementPickerDialog.showDialog('Select a statemachine model to validate', null, type.UMLStateMachine).then(function ({
            buttonId,
            returnValue
        }) {
            if (buttonId === 'ok') {
                if (returnValue instanceof type['UMLStateMachine']) {
                    _do_validate(returnValue, false);
                } else {
                    app.dialogs.showInfoDialog('Please select a StateMachine!');
                }
            };
        });
    }

    if (!fsmModelValidationPanel.isVisible()) {
        fsmModelValidationPanel.show();
    }
}

function handleFsmModelValidateAll(message) {
    var args = parseArgs(message);
    // handleFsmModelValidate(ar)
}

function showUsage() {
    ipcRenderer.send("console-log", "staruml exec -a help");
    ipcRenderer.send("console-log", "staruml exec -a \"s=@UMLStateMachine[name=StateMachine1]\" -a t=st [-a \"o=out/<%=element.name%>.st\"] <projectfile.mdj> -c fsm_st:generate");
    ipcRenderer.send("console-log", "staruml exec -a \"s=@UMLStateMachine[name=StateMachine1]\" <projectfile.mdj> -c fsm_st:validate");
    ipcRenderer.send("console-log", "s = element selector(should be statemachines)\nt = target st|brst|scl\no = outputfile location and naming");
}

/**
 * Handle a select of a validation error message.
 * It will select the element in the model tree and diagram (if possible).
 */
function handleSelectValidationErrorOnClick()
{
    var selectedItem = null;
    if (listView.select().length > 0)
     {
        var data = dataSource.view();
        selectedItems = $.map(listView.select(), function(item) {
                return data[$(item).index()];
            });
    }

    if (selectedItems && selectedItems.length > 0)
    {
        var element = app.repository.get(selectedItems[0].id);
        if (element) {
            app.modelExplorer.select(element, true);
            app.commands.execute('edit:select-in-diagram');
        }
    }
}

/**
 * Setup the validation message list and attach event handlers
 */
function initializeValidationMessagesPanel() {
    $fsmModelValidationPanel = $(templatePanel);
    $title = $fsmModelValidationPanel.find(".title");
    $close = $fsmModelValidationPanel.find(".close");
    $close.click(function () {
        fsmModelValidationPanel.hide();
    });
    $refresh = $fsmModelValidationPanel.find("#fsm-model-validator-refresh");
    $refresh.click(function (e) {
        handleFsmModelValidate();
    });
    fsmModelValidationPanel = app.panelManager.createBottomPanel("?", $fsmModelValidationPanel, 60);

    // Setup Validation Message List
    $listView = $fsmModelValidationPanel.find(".listview");
    $listView.kendoListView({
        dataSource: dataSource,
        template: templateItem,
        selectable: "multiple"
    });
    listView = $listView.data("kendoListView");
    $listView.click(function (e) {
        handleSelectValidationErrorOnClick();
    });
}

/**
 * Initialize the StarUML Extension
 */
function init () {
    initializeValidationMessagesPanel();

    app.commands.register('fsm_st:generate', handleFsmGenerate, 'FSM Generate');
    app.commands.register('fsm_st:validate', handleFsmModelValidate, 'FSM Validate');
    app.commands.register('fsm_st:validateall', handleFsmModelValidateAll, 'FSM Validate All');
}


exports.init = init

# StarUML extension AWETA FSMST

FSMST is an [StarUML](https://staruml.io/) extension that generates IEC 61131-3Structered Text of a StarUML StateMachine diagram.
The generated output is Finite-state machine in the form of a `Function Block`.

The generates is intended to be used as generated, please don't make changes to the generated code! This makes it possible to update your statemachine and reasy reploy the update Function Block.

## Installation
The extension is tested with StarUML version 6.1.1.
Follow the StarUML guideline for installing extensions.

### For Windows
Copy the extension directory to:
```
C:/Users/${env.USERNAME}/AppData/Roaming/StarUML/extensions/user
```

Or run the `ant` with as target install :
```
ant install
```

## Features

* Extension for StarUML:
  * From the GUI (Tools Menu or key combination CTRL+W)
  * As from the command-line (documenation below)
* Generate a finite-state machine in structured text based on StarUML statemachine diagram.
* Output  can be a single file or split in to 3: .type .fun, and .st
* Support for both composite and parallel (join and fork) substatemachines.
* Restore history for composite statemachines.
* Special methods available to use in effects and activities:
  * Start/Stop timers
  * Set and Reset bool
  * Put and get numbers
  * Test is bool is set and reset
  * By using the special functions in the statemachine, variable for the function block are automaticly extracted. See [Symbol Extraction](SYMBOLEXTRACTION.MD) for more information.
* A state name only has to be unqiue with in single UMLRegion (Each composite statemachine contains itw own regions).
* Direct support for timers

## Supported StarUML statemachine elements

* Basic:
  * Simple State
  * Initial State
  * Final State
  * Choice
  * Transition
  * Self Transition
* Advanced:
  * Composite State with multiple regions (parallel substatemachines)
  * Join
  * Fork
  * Shallow History

When from a self transition the property `kind` is set to `internal`, the entry and exit activities are not triggered.

*Be very carefull that the in StartUML not only the diagram matches the hierarchy but also in the model tree.
It is very easy to make a mistake with Composite state!*





## Command-line:

StartUML supports running commands from the command-line with the `exec` argument.
The FSMST extension supplies the command `fsm_st:cligenerate` for this purpose.

```
staruml exec -a "s=@UMLStateMachine[name=StateMachine1]" [-a m=1] [-a "o=out/<%=element.name%>.st"] <projectfile.mdj> -c fsm_st:cligenerate
s = element selector(should be statemachines)
m = generate multiple files(type, fun ,and st) per statemachine
o = outputfile location and naming
```

Example to generate a single structured text file per statemachine in the project in the directory `out`:
```powershell
Set-Alias -Name staruml -Value 'C:\Program Files\StarUML\StarUML.exe'
staruml exec -a 'm=0' .\your_project_statemachine.mdj -c fsm_st:cligenerate
```


Example to generate a single structured text file for the statemachine named `StateMachine1` in the project in the directory `out`:
```powershell
Set-Alias -Name staruml -Value 'C:\Program Files\StarUML\StarUML.exe'
staruml exec -a 'm=0' -a 's=@UMLStateMachine[name=StateMachine1]'.\your_project_statemachine.mdj -c fsm_st:cligenerate
```

## Implementation of the StateMachine with structured text

And enum type is created with for item for each state.

For each statemachine a function block is created.
The function block interface is automaticly created from the diagram.

For each trigger event in the FSM a `bool` input is created in the function block interface.
The raising edge of each input is used as internal trigger, by creating a `R_TRIG`.




The generated Finite-state machine is a standalone state machine in the form of Function Block.
Finite-state machines makes it possible to describe think about the logic in an more abstract way.

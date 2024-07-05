# symbol extraction guidelines

To generate the proper events, inputs and outputs the correct naming convention must be used.

Supported functions:
* Set( _name_ )
* Reset( _name_ )
* IsSet( _name_ )
* IsReset( _name_ )
* Put( _name_, _value_ )
* Get( _name_ )
* LGet( _name_ )
* Test( _name_ )
* StartTimer( _name_, _timeout_ )
* CancelTimer( _name_ )

Notes: 
* function name is case-insensitive. There may be no space between the function name and (.
* unsupported function names will not be converted.
* guards support additional brackets (), && for AND, || for OR constructions.
* when functions create input and output of the same name, the function block will have an IN_OUT variable
* Names of triggers are free. Triggers which do not match the name of a StartTimer will generate an internal R_TRIG function block and an input BOOL

## Set( _name_ )
Will set the BOOL variable _name_ to TRUE
Creates an output on the function block

Allowed in: Activities, Effects

## Reset( _name_ )
Will set the BOOL variable _name_ to FALSE
Creates an output on the function block

Allowed in: Activities, Effects

## IsSet( _name_ )
Will return TRUE if the BOOL variable _name_ is TRUE
FALSE otherwise
Creates an input on the function block

Allowed in: Activities, Effects, Guards

## IsReset( _name_ )
Will return TRUE if the BOOL variable _name_ is FALSE
FALSE otherwise

Creates an input on the function block

Allowed in: Activities, Effects, Guards

## Put( _name_, _value_ )
Will set the DINT variable _name_ to _value_
Creates an output on the function block

Allowed in: Activities, Effects

## Get( _name_ )
Will return the value of the variable _name_
Creates an input on the function block

Allowed in: Activities, Effects, Guards

## LGet( _name_ )
Will return the value of the variable _name_
Creates an output var on the function block instead of an input

Allowed in: Activities, Effects, Guards

## Test( _name_ )
Will (re)-create the trigger event _name_ if the value of the corresponding event is TRUE
Does not create an in- or output while the event should exist and should have created the var

Allowed in: Entry Activities

## StartTimer( _name_, _timeout_ )
Will start timer _name_ , after _timeout_ msec event _name_ will be generated
Creates an internal TON var.

Allowed in: Activities, Effects

## CancelTimer( _name_ )
Will cancel timer _name_
Does not create vars, because there should be a corresponding StartTimer

Allowed in: Activities, Effects

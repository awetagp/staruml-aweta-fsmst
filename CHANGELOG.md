0.3.0 = 2024-07-23
====

Fixes:
* For default ST use datype prefix with enum values

Features:
* Sort variables


0.2.1 - 2024-07-16
===

Fixes:
* ST VAR_IN_OUT is missing a '_' between IN_OUT.
* In nested composited state, a self transition doesn't trigger the entries of the composited state.

0.2.0 - 2024-07-15
====

Features:
* Rewrite of codewriter; cleaner output and easier to add different/variant languages.
* Proto of Python output (not finished yet)

Fixes:
* External self tranistion composite state goes to InActive when multiple levels deep are used.

0.1.0 - 2024-07-08
=====

Features:
* Autonaming of Intial & Final State. When multiple Init/Final states exists, they should have an unique name. To prevent manually naming 3 chars of the ID are added. You can still overwrite this by setting the name by hand.

Fixes:
* Initial substate transition handling is wrong. Result in a 'top level' `ELSE` instead of a `IF`.

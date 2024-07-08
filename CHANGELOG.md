0.1.0  - 2024-07-08
=====

Features:
* Autonaming of Intial & Final State. When multiple Init/Final states exists, they should have an unique name. To prevent manually naming 3 chars of the ID are added. You can still overwrite this by setting the name by hand.

Fixes:
* Initial substate transition handling is wrong. Result in a 'top level' `ELSE` instead of a `IF`.

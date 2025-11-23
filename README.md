# red-capstone

![red-capstone](red-capstone.png)

red team's capstone project!

**product owner**: @
**scrum master**: @DelaramDoroud Delaram Doroudgarian
**development team**:

- @member1 Member One
- @member2 Member Two
- @member3 Member Three
- @member4 Member Four
- @member5 Member Five
- @member6 Member Six

## Terminology / Glossary

This section provides definitions for key terms used in this project to ensure clarity and consistency, **before** refining user stories.

- Match Setting ->
A Match Setting is the template or configuration that is defined by teacher.
It includes everything a teacher needs to set up a problem for a match.
Contains:
.Title
.description
.Reference solution (teacher’s correct code)
.Public tests (visible to students)
.Private tests (hidden from students)
.Validation state: Draft or Ready
Lifecycle:
Draft → Validated (Ready) → Used in Match → Updated / Duplicated

Match -> A Match is an individual exercise or competition instance within a Challenge.
It represents a single task that students can attempt, submit solutions for, and be automatically evaluated on.

A Match is a scheduled session created from a Match Setting.
It represents one instance of students competing on that specific problem.
To run the actual competition between students on a given problem.
Contains:
.Match Setting
.Students
.Timers and deadlines for each phase
.Student submissions, votes, and scores
Lifecycle:
Scheduled → Coding Phase →View others’ solutions → Voting Phase → Completed

Challenge -> A Challenge is a collection of one or more Matches grouped under a common theme or goal (e.g., “Sorting Algorithms Challenge” or “Data Structures Challenge”).
Each challenge contains multiple matches that the teacher creates, each focusing on a different problem or aspect of the overall topic.

Public Test -> A Public Test is a test case that is visible to students.
They can see both the input and the expected output.

Private Test -> A Private Test is a hidden test case, not visible to students.
Only the teacher and the system know its input and expected output.

Peer Review ->
Peer review is the process in which students evaluate each other’s submitted code solutions after the coding phase of a match.
For each solution, they vote:correct,incorrect,abstain.
If a student votes Incorrect, he/she must provide a failing test case.

Hall of Fame or Leader Board ->

Problem ->

## todos

- [ ] ...

## Contribution guidelines

If you want to contribute to SPy, be sure to review the [contribution guidelines](CONTRIBUTING.md)

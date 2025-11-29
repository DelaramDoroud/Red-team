'use client';

import ChallengeList from '#modules/challenge/list';
import { Badge } from '#components/common/Badge';
import { Button } from '#components/common/Button';
import { Toggle } from '#components/common/Toggle';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  TableFooter,
  TableCaption,
} from '#components/common/Table';
import {
  FieldSet,
  Field,
  FieldLabel,
  FieldContent,
  FieldDescription,
  FieldError,
} from '#components/common/Field';

import { useState } from 'react';
import { Input } from '#components/common/Input';
import styles from './page.module.scss';

export default function HomePage() {
  const data = [
    { id: 1, name: 'Sepideh' },
    { id: 2, name: 'Delaram' },
    { id: 3, name: 'Aida' },
  ];
  const [error, setError] = useState(null);

  const handleBlur = (e) => {
    if (!e.target.value.trim()) {
      setError([{ message: 'This field cannot be empty.' }]);
    } else {
      setError(null);
    }
  };
  return (
    <section className={styles.container}>
      <header className={styles.hero}>
        <h1>CodyMatch demo dashboard</h1>
        <p>
          This page shows how to wire a simple Challenge list to the backend
          using <code>useFetchData</code> and a dedicated{' '}
          <code>useChallenge</code> hook.
        </p>
      </header>
      <div className='flex justify-between'>
        <span> Buttons</span>
        <Button>default/primary</Button>
        <Button variant='secondary'>secondary</Button>
        <Button variant='outline'>outline</Button>
      </div>
      <div className='flex justify-between'>
        <span> Badge</span>
        <Badge>default/primary</Badge>
        <Badge variant='secondary'>secondary</Badge>
        <Badge variant='outline'>outline</Badge>
      </div>
      <div className='flex justify-between'>
        <span> Toggle</span>
        <Toggle>Default</Toggle>
        <Toggle variant='outline'>Outline</Toggle>
      </div>
      <div className='max-w-xl mx-auto mt-10 p-6 border border-secondary-200 rounded-lg bg-secondary-0'>
        <FieldSet>
          <Field orientation='horizontal' data-invalid={!!error}>
            <FieldLabel htmlFor='challenge-name'>Challenge name</FieldLabel>

            <FieldContent>
              <Input
                id='challenge-name'
                name='challenge-name'
                placeholder='enter a name'
                onBlur={handleBlur}
              />

              <FieldDescription>Pick a unique challenge name.</FieldDescription>
              <FieldError errors={error} />
            </FieldContent>
          </Field>

          <Field orientation='horizontal' data-invalid={!!error}>
            <FieldLabel htmlFor='match-name'>Match name</FieldLabel>

            <FieldContent>
              <Input
                id='match-name'
                name='match-name'
                placeholder='enter a name'
                onBlur={handleBlur}
              />

              <FieldDescription>Pick a unique match name.</FieldDescription>
              <FieldError errors={error} />
            </FieldContent>
          </Field>
        </FieldSet>
      </div>
      <div>
        <span> Table</span>
        <Table>
          <TableCaption>Table Caption</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {data.map((person) => (
              <TableRow key={person.id}>
                <TableCell>{person.id}</TableCell>
                <TableCell>{person.name}</TableCell>
              </TableRow>
            ))}
          </TableBody>

          <TableFooter>
            <TableRow>
              <TableCell colSpan={3}>Total people: {data.length}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
      <ChallengeList />
    </section>
  );
}

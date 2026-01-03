'use client';

import { useState } from 'react';

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
import { Input } from '#components/common/Input';
import useRoleGuard from '#js/useRoleGuard';

import styles from './page.module.css';

export default function HomePage() {
  const data = [
    { id: 1, name: 'Sepideh' },
    { id: 2, name: 'Delaram' },
    { id: 3, name: 'Aida' },
  ];
  const { isAuthorized } = useRoleGuard({
    allowedRoles: ['teacher', 'admin'],
  });
  const [error, setError] = useState(null);

  if (!isAuthorized) return null;

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
          This page showcases the main UI components wired to the CodyMatch
          design system, including <code>Button</code>, <code>Badge</code>,{' '}
          <code>Toggle</code>, form fields and tables.
        </p>
      </header>

      <div className={styles.showcaseRow}>
        <span className={styles.showcaseLabel}>Buttons</span>
        <div className={styles.showcaseGroup}>
          <Button>Primary</Button>
          <Button variant='secondary'>Secondary</Button>
          <Button variant='outline'>Outline</Button>
          <Button variant='ghost' disabled>
            Disabled
          </Button>
          <Button variant='destructive'>Destructive</Button>
        </div>
      </div>

      {/* Badges */}
      <div className={styles.showcaseRow}>
        <span className={styles.showcaseLabel}>Badges</span>
        <div className={styles.showcaseGroup}>
          <Badge>Primary</Badge>
          <Badge variant='secondary'>Secondary</Badge>
          <Badge variant='outline'>Outline</Badge>
        </div>
      </div>

      {/* Toggles */}
      <div className={styles.showcaseRow}>
        <span className={styles.showcaseLabel}>Toggle</span>
        <div className={styles.showcaseGroup}>
          <Toggle>Default</Toggle>
          <Toggle variant='outline'>Outline</Toggle>
        </div>
      </div>

      <div className={styles.formCard}>
        <FieldSet>
          <Field orientation='horizontal' data-invalid={!!error}>
            <FieldLabel htmlFor='challenge-name'>Challenge name</FieldLabel>

            <FieldContent>
              <Input
                id='challenge-name'
                name='challenge-name'
                placeholder='Enter a name'
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
                placeholder='Enter a name'
                onBlur={handleBlur}
              />

              <FieldDescription>Pick a unique match name.</FieldDescription>
              <FieldError errors={error} />
            </FieldContent>
          </Field>
        </FieldSet>
      </div>

      {/* Table */}
      <div className={styles.tableSection}>
        <span className={styles.showcaseLabel}>Table</span>
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

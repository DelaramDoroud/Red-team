import { Button } from '#components/common/Button';
import Pagination from '#components/common/Pagination';
import ToggleSwitch from '#components/common/ToggleSwitch';
import {
  DATE_TIME_PATTERN,
  resolvePickerValue,
} from '#js/challenge-form-utils';
import * as Constants from '#js/constants';

function DateTimePickerIcon({ className }) {
  return (
    <svg aria-hidden='true' viewBox='0 0 24 24' className={className}>
      <path
        fill='currentColor'
        d='M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1.5A2.5 2.5 0 0 1 22 6.5v13A2.5 2.5 0 0 1 19.5 22h-15A2.5 2.5 0 0 1 2 19.5v-13A2.5 2.5 0 0 1 4.5 4H6V3a1 1 0 0 1 1-1zm12.5 6H4.5v11.5c0 .3.2.5.5.5h15a.5.5 0 0 0 .5-.5V8zM4.5 6a.5.5 0 0 0-.5.5V7h16v-.5a.5.5 0 0 0-.5-.5H4.5z'
      />
    </svg>
  );
}

function DateTimeField({
  canPick,
  challenge,
  disabled,
  field,
  getMinValue,
  label,
  onBlur,
  onInputChange,
  onPickerChange,
  openPicker,
  pickerRef,
  styles,
}) {
  const disabledState =
    Boolean(disabled) || (field === 'endDatetime' && !canPick);
  const pickerLabel = field === 'startDatetime' ? 'start' : 'end';

  return (
    <div className={styles.field}>
      <label htmlFor={field}>
        {label}
        <div className={styles.datetimeGroup}>
          <input
            id={field}
            type='text'
            name={field}
            value={challenge[`${field}Input`]}
            onChange={onInputChange}
            onBlur={() => onBlur(field)}
            className={styles.datetime}
            placeholder='8:32 PM, 30/12/2026'
            pattern={DATE_TIME_PATTERN}
            title='Use format: 8:32 PM, 30/12/2026'
            required
            disabled={disabledState}
          />
          <button
            type='button'
            className={styles.datetimeButton}
            onClick={() => openPicker(pickerRef)}
            aria-label={`Pick ${pickerLabel} date and time`}
            disabled={disabledState}
          >
            <DateTimePickerIcon className={styles.datetimeIcon} />
          </button>
          <input
            ref={pickerRef}
            type='datetime-local'
            className={styles.datetimePicker}
            value={resolvePickerValue(challenge[field])}
            onChange={onPickerChange(field)}
            min={getMinValue()}
            tabIndex={-1}
            aria-hidden='true'
            disabled={disabledState}
          />
        </div>
      </label>
    </div>
  );
}

function MatchSettingsTable({
  challenge,
  currentItems,
  formDisabled,
  styles,
  toggleSetting,
}) {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Select</th>
          <th>Title</th>
        </tr>
      </thead>
      <tbody>
        {currentItems.map((match) => {
          const isSelected = challenge.matchSettingIds.includes(match.id);
          const handleRowToggle = () => toggleSetting(match.id);
          const handleRowKeyDown = (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              handleRowToggle();
            }
          };

          return (
            <tr
              key={match.id}
              role='button'
              tabIndex={0}
              onClick={handleRowToggle}
              onKeyDown={handleRowKeyDown}
            >
              <td style={{ textAlign: 'center' }}>
                <input
                  aria-label='select setting'
                  type='checkbox'
                  checked={isSelected}
                  onChange={handleRowToggle}
                  onClick={(event) => event.stopPropagation()}
                  disabled={formDisabled}
                />
              </td>
              <td style={{ textAlign: 'center' }}>{match.problemTitle}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function ChallengeForm({
  canPickEndDate,
  challenge,
  currentItems,
  currentPage,
  error,
  formDisabled,
  getMinDateTimeValue,
  getMinEndDateValue,
  headingDescription,
  headingTitle,
  isSubmitting,
  onDateBlur,
  onDatePickerChange,
  onFieldChange,
  onPageChange,
  onSubmit,
  openPicker,
  startPickerRef,
  endPickerRef,
  styles,
  submitLabel,
  submitLoadingLabel,
  submitTestId,
  submitTitle,
  successMessage,
  toggleSetting,
  toggleStatus,
  totalPages,
}) {
  return (
    <main role='main' className={styles.main} aria-labelledby='page-title'>
      <div className={styles.header}>
        <h1 id='page-title'>{headingTitle}</h1>
        <p>{headingDescription}</p>
      </div>
      <form
        data-testid='challenge-form'
        onSubmit={onSubmit}
        className={styles.card}
      >
        <div className={styles.field}>
          <label htmlFor='title'>
            Challenge Name
            <input
              id='title'
              type='text'
              value={challenge.title}
              onChange={onFieldChange}
              name='title'
              className={styles.input}
              required
              disabled={formDisabled}
            />
          </label>
        </div>

        <div className={styles.row}>
          <DateTimeField
            canPick={canPickEndDate}
            challenge={challenge}
            disabled={formDisabled}
            field='startDatetime'
            getMinValue={getMinDateTimeValue}
            label='Start Date/Time'
            onBlur={onDateBlur}
            onInputChange={onFieldChange}
            onPickerChange={onDatePickerChange}
            openPicker={openPicker}
            pickerRef={startPickerRef}
            styles={styles}
          />
          <DateTimeField
            canPick={canPickEndDate}
            challenge={challenge}
            disabled={formDisabled}
            field='endDatetime'
            getMinValue={getMinEndDateValue}
            label='End Date/Time'
            onBlur={onDateBlur}
            onInputChange={onFieldChange}
            onPickerChange={onDatePickerChange}
            openPicker={openPicker}
            pickerRef={endPickerRef}
            styles={styles}
          />
        </div>

        <div>
          <div className={styles.row}>
            <div className={styles.field}>
              <label htmlFor='duration'>
                Coding Phase Duration (min)
                <input
                  id='duration'
                  type='number'
                  name='duration'
                  value={challenge.duration}
                  onChange={onFieldChange}
                  className={styles.number}
                  min={2}
                  required
                  disabled={formDisabled}
                />
              </label>
            </div>
            <div className={styles.field}>
              <label htmlFor='durationPeerReview'>
                Duration Peer Review Duration (min)
                <input
                  id='durationPeerReview'
                  type='number'
                  name='durationPeerReview'
                  value={challenge.durationPeerReview}
                  onChange={onFieldChange}
                  className={styles.number}
                  min={2}
                  required
                  disabled={formDisabled}
                />
              </label>
            </div>
          </div>
        </div>

        <div>
          <div className={styles.row}>
            <div className={styles.field}>
              <label htmlFor='allowedNumberOfReview'>
                Expected Reviews per Submission
                <input
                  id='allowedNumberOfReview'
                  type='number'
                  name='allowedNumberOfReview'
                  value={challenge.allowedNumberOfReview}
                  onChange={onFieldChange}
                  className={`${styles.number} ${styles.expectedReviewInput}`}
                  min={2}
                  required
                  disabled={formDisabled}
                />
              </label>
            </div>
          </div>
        </div>

        <div className={styles.field}>
          <span>Status</span>
          <ToggleSwitch
            checked={challenge.status === Constants.ChallengeStatus.PUBLIC}
            label={
              challenge.status === Constants.ChallengeStatus.PUBLIC
                ? 'Public'
                : 'Private'
            }
            onChange={toggleStatus}
            disabled={formDisabled}
          />
        </div>

        <div className={styles.field}>
          <strong>
            Selected Match Settings: {challenge?.matchSettingIds?.length}
          </strong>
        </div>

        <MatchSettingsTable
          challenge={challenge}
          currentItems={currentItems}
          formDisabled={formDisabled}
          styles={styles}
          toggleSetting={toggleSetting}
        />

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />

        <div className={styles.submitWrapper}>
          <div className={styles.feedback} aria-live='polite'>
            {error ? (
              <span className={styles.feedbackError} role='alert'>
                {error}
              </span>
            ) : null}
            {!error && successMessage ? (
              <span className={styles.feedbackSuccess} role='status'>
                {successMessage}
              </span>
            ) : null}
          </div>
          <Button
            data-testid={submitTestId}
            type='submit'
            disabled={isSubmitting || formDisabled}
            aria-busy={isSubmitting}
            name='submit'
            title={submitTitle}
          >
            {isSubmitting ? (
              <span className={styles.spinner} aria-hidden />
            ) : null}
            {isSubmitting ? submitLoadingLabel : submitLabel}
          </Button>
        </div>
      </form>
    </main>
  );
}

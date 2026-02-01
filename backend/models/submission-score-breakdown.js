import { Model, DataTypes } from 'sequelize';
import sequelize from '#root/services/sequelize.js';

class SubmissionScoreBreakdown extends Model {}

SubmissionScoreBreakdown.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    // --- NUOVO CAMPO OBBLIGATORIO ---
    challengeParticipantId: {
      type: DataTypes.INTEGER,
      allowNull: false, // Il voto appartiene sempre a un partecipante
      field: 'challenge_participant_id',
    },
    // --- CAMPO MODIFICATO (ORA OPZIONALE) ---
    submissionId: {
      type: DataTypes.INTEGER,
      allowNull: true, // Può essere NULL se lo studente non ha consegnato codice
      field: 'submission_id',
    },
    codeReviewScore: {
      type: DataTypes.FLOAT,
      allowNull: false,
      field: 'code_review_score',
    },
    implementationScore: {
      type: DataTypes.FLOAT,
      allowNull: false,
      field: 'implementation_score',
    },
    totalScore: {
      type: DataTypes.FLOAT,
      allowNull: false,
      field: 'total_score',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'created_at',
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'updated_at',
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'SubmissionScoreBreakdown',
    tableName: 'submission_score_breakdown',
    schema: 'public',
    underscored: true,
    timestamps: true,

    indexes: [
      {
        unique: true,
        // L'indice univoco ora deve essere sul PARTECIPANTE
        // Uno studente può avere solo un breakdown per challenge
        fields: ['challenge_participant_id'],
        name: 'uq_submission_score_breakdown_participant_id',
      },
    ],
  }
);

SubmissionScoreBreakdown.initializeRelations = (models) => {
  // Relazione esistente (resa opzionale)
  SubmissionScoreBreakdown.belongsTo(models.Submission, {
    as: 'submission',
    foreignKey: 'submissionId',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });

  // --- NUOVA RELAZIONE FONDAMENTALE ---
  SubmissionScoreBreakdown.belongsTo(models.ChallengeParticipant, {
    as: 'challengeParticipant',
    foreignKey: 'challengeParticipantId',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
};

export default SubmissionScoreBreakdown;

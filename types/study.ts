import type { FieldValue, Timestamp } from 'firebase/firestore';
import type { LogoFeedbackValue } from '@/lib/logo-feedback';

export type RespondentType =
  | 'professional_available'
  | 'professional_employed'
  | 'company'
  | 'agency';

export type StudyAnswerValue =
  | string
  | string[]
  | number
  | boolean
  | null
  | {
      answer: string;
      reason?: string;
    };

export type StudyAnswers = Record<string, StudyAnswerValue>;

export type StudyAcquisitionChannelCode =
  | 'linkedin'
  | 'facebook'
  | 'instagram'
  | 'message_prive'
  | 'bouche_a_oreille'
  | 'google'
  | 'ust_workflow'
  | 'autre'
  | 'recommendation'
  | 'direct';

export type StudyAcquisitionSourceCode = StudyAcquisitionChannelCode;

export interface StudyResponse {
  respondentType: RespondentType;
  answers: StudyAnswers;
  wantsLaunchNotification: boolean;
  wantsBetaAccess: boolean;
  wantsProjectUpdates?: boolean;
  email: string;
  phone: string;
  source?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  acquisitionChannel?: StudyAcquisitionChannelCode;
  acquisitionChannelLabel?: string;
  discoverySource?: StudyAcquisitionSourceCode;
  logoFeedback?: LogoFeedbackValue;
  visitorFingerprint?: string;
  createdAt: Timestamp | FieldValue;
}

export interface StudyResponseInput extends Omit<StudyResponse, 'createdAt'> {}

export interface StudyResponseRecord {
  id: string;
  respondentType?: RespondentType;
  answers?: Partial<Record<string, StudyAnswerValue>>;
  wantsLaunchNotification?: boolean;
  wantsBetaAccess?: boolean;
  wantsProjectUpdates?: boolean;
  email?: string;
  phone?: string;
  source?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  acquisitionChannel?: StudyAcquisitionChannelCode;
  acquisitionChannelLabel?: string;
  discoverySource?: StudyAcquisitionSourceCode;
  logoFeedback?: LogoFeedbackValue;
  visitorFingerprint?: string;
  createdAt?: Timestamp | FieldValue | null;
}

export type StudyQuestionType = 'single' | 'multi' | 'yesno' | 'text' | 'textarea';

export type StudyQuestionCategory =
  | 'segmentation'
  | 'qualification'
  | 'market'
  | 'intent'
  | 'barrier'
  | 'conversion'
  | 'contact';

export interface StudyQuestionOption {
  value: string;
  label: string;
  searchTerms?: string[];
}

export interface StudyQuestionContext {
  respondentType: RespondentType;
  answers: StudyAnswers;
}

export type StudyQuestionVisibilityPredicate = (context: StudyQuestionContext) => boolean;
export type StudyQuestionOptionsResolver = (context: StudyQuestionContext) => StudyQuestionOption[];
export type StudyQuestionOptions = StudyQuestionOption[] | StudyQuestionOptionsResolver;

export interface StudyQuestion {
  id: string;
  label: string;
  description?: string;
  type: StudyQuestionType;
  options?: StudyQuestionOptions;
  required: boolean;
  maxSelections?: number;
  visibleIf?: StudyQuestionVisibilityPredicate;
  firestoreKey: string;
  category: StudyQuestionCategory;
  placeholder?: string;
}

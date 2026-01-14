export interface Case {
  id: string;
  caseNumber: string;
  title: string;
  status: string;
  applicant?: string; 
}
export interface CaseItem extends Case {
  type: string;
  subtype: string;
  lawyer: string;
  client: string;
  submittedDate: string;
  submittedTime: string;
  documents: number;
  urgent: boolean;
  status: 'pending' | 'under-review' | 'approved' | 'returned';
}
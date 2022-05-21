export interface ISubscription {
  id: string;
  publisherId: string;
  offerId: string;
  name: string;
  saasSubscriptionStatus: string;
  beneficiary: {
    emailId: string;
    objectId: string;
    tenantId: string;
    pid: string;
  };
  purchaser: {
    emailId: string;
    objectId: string;
    tenantId: string;
    pid: string;
  };
  planId: string;
  term: {
    termUnit: string;
    startDate: Date;
    endDate: Date;
  };
  autoRenew: boolean;
  isTest: boolean;
  isFreeTrial: boolean;
  allowedCustomerOperations: string[];
  sandboxType: string;
  lastModified: Date;
  quantity: number;
  sessionMode: string;
}

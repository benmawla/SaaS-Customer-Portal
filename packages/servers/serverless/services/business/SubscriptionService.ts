import { Logger } from "@azure/functions";
import {
  IConfig,
  ISubscription,
  IAuthenticateResponse,
  IOrganization,
  IUser,
  Role,
  ActivateSubscription,
  SaasSubscriptionStatus,
  AddSubscription,
} from "../../entities";
import {
  BaseRepository,
  OrganizationRepositoryFactory,
  UserRepositoryFactory,
} from "../../repositories";
import { HttpProvider, AuthenticationProvider } from "../../utils";
import { ISubscriptionService } from "../interfaces";

export class SubscriptionService implements ISubscriptionService {
  private readonly _userRepository: BaseRepository<IUser>;
  private readonly _userFactory = new UserRepositoryFactory();
  private readonly _organizationFactory = new OrganizationRepositoryFactory();
  private readonly _organizationRepository: BaseRepository<IOrganization>;
  private static _httpService: HttpProvider = new HttpProvider();
  private static _authenticationService: AuthenticationProvider;
  private readonly _config: IConfig;
  private readonly _logger: Logger;

  constructor(config: IConfig, log: Logger) {
    this._config = config;
    this._logger = log;
    this._userRepository = this._userFactory.initRepository(
      this._config.dbType
    );
    this._organizationRepository = this._organizationFactory.initRepository(
      this._config.dbType
    );
    this.initStaticMembers();
  }

  private initStaticMembers() {
    this.initHttpProvider();
    this.initAuthProvider();
  }

  private initHttpProvider() {
    if (!SubscriptionService._httpService) {
      SubscriptionService._httpService = new HttpProvider();
    }
  }

  private initAuthProvider() {
    if (!SubscriptionService._authenticationService) {
      SubscriptionService._authenticationService = new AuthenticationProvider(
        this._config
      );
    }
  }

  async removeSubscription(subscription: ISubscription): Promise<void> {
    const { id, quantity, purchaser, offerId } = subscription;
    const { tenantId } = purchaser;
    const logMessage = `subscriptionId ${id}, tenantId ${
      purchaser.tenantId
    } offerId ${offerId} quantity ${quantity}, userId ${
      purchaser.objectId
    }, dateTime ${new Date().toISOString()}`;
    this._logger(
      `[SubscriptionService - removeSubscription] start for ${logMessage}`
    );
    await this.removeAllSubscriptionUsers(tenantId, id);
    await this.updateSubscriptionStatus(tenantId, subscription);
    this._logger(
      `[SubscriptionService - removeSubscription] finish for ${logMessage}`
    );
  }

  private async updateSubscriptionStatus(
    tenantId: string,
    subscription: ISubscription
  ) {
    const logMessage = `tenantId ${tenantId}, subscriptionId ${
      subscription.id
    }, dateTime ${new Date().toISOString()}`;
    this._logger(
      `[SubscriptionService - removeSubscription] start for ${logMessage}`
    );
    try {
      const organization =
        await this._organizationRepository.findOne<IOrganization>({ tenantId });
      const dbSubscription: ISubscription = this.getOrganizationSubscription(
        organization,
        subscription
      );
      dbSubscription.saasSubscriptionStatus =
        SaasSubscriptionStatus.Unsubscribed;
      organization.subscriptions = organization.subscriptions.filter(
        (s: ISubscription) => s.id !== dbSubscription.id
      );
      await this.updateOrganizationSubscriptions(organization, dbSubscription);
    } catch (error: any) {
      this._logger.error(
        `[SubscriptionService - removeSubscription] error for ${logMessage}, error: ${error.message}`
      );
      throw error;
    }

    this._logger(
      `[SubscriptionService - removeSubscription] finish for ${logMessage}`
    );
  }

  private async removeAllSubscriptionUsers(
    tenantId: string,
    subscriptionId: string
  ) {
    const logMessage = `for tenant Id ${tenantId}, subscriptionId ${subscriptionId}, dateTime ${new Date().toISOString()}`;
    this._logger.info(
      `[SubscriptionService - removeAllSubscriptionUsers] start for ${logMessage}`
    );
    const users = await this._userRepository.find<IUser>({
      tenantId,
      subscriptionId,
    });
    const defaultUserSubscription: IUser = {
      role: Role.Member,
      subscriptionId: "",
      license: "Free",
    };
    try {
      for (let index = 0; index < users.length; index++) {
        const user = users[index];
        await this._userRepository.findOneAndUpdate(
          { _id: user._id },
          defaultUserSubscription
        );
        this._logger.info(
          `[SubscriptionService - removeAllSubscriptionUsers] remove subscription from user ${user._id}, ${logMessage}`
        );
      }
    } catch (error: any) {
      this._logger.error(
        `[SubscriptionService - removeAllSubscriptionUsers] error for ${logMessage}, error: ${error.message}`
      );
      throw error;
    }
    this._logger.info(
      `[SubscriptionService - removeAllSubscriptionUsers] finish for ${logMessage}`
    );
  }

  async resolveSubscription(token: string): Promise<ISubscription> {
    this._logger.info(
      `[resolveSubscription] started ${new Date().toISOString()}`
    );
    let subscriptionRes: AddSubscription;
    try {
      const { access_token }: IAuthenticateResponse =
        await SubscriptionService._authenticationService.getAppAuthenticationToken();
      if (access_token) {
        subscriptionRes = await this.getSubscriptionDetails(
          access_token,
          token
        );
        await this.activateSubscription(
          subscriptionRes.subscription,
          access_token
        );
        if (subscriptionRes?.subscription) {
          const organization: IOrganization =
            await this.getOrCreateOrganization(subscriptionRes.subscription);
          const dbSubscription = this.getOrganizationSubscription(
            organization,
            subscriptionRes.subscription
          );
          if (dbSubscription) {
            organization.subscriptions = organization.subscriptions.filter(
              (s: ISubscription) => s.id !== dbSubscription.id
            );
          }
          await this.updateOrganizationSubscriptions(
            organization,
            subscriptionRes.subscription
          );
          await this.getOrCreateSubscriptionOwners(
            subscriptionRes.subscription
          );
        }
      }
    } catch (error: any) {
      this._logger.error(
        `[resolveSubscription] error: ${
          error.message
        } ${new Date().toISOString()}`
      );
      throw error;
    }
    this._logger.info(
      `[resolveSubscription] finished ${new Date().toISOString()}`
    );
    return subscriptionRes?.subscription;
  }

  async activateSubscription(
    subscriptionRes: ISubscription,
    access_token: string
  ): Promise<void> {
    const isSubscriptionActive =
      subscriptionRes.saasSubscriptionStatus ===
      SaasSubscriptionStatus.Subscribed;
    if (!isSubscriptionActive) {
      const activatePayload: ActivateSubscription = {
        planId: subscriptionRes.planId,
        quantity: subscriptionRes.quantity,
      };
      await this.callActivateSubscriptionApi(
        subscriptionRes.id,
        access_token,
        activatePayload
      );
      subscriptionRes.saasSubscriptionStatus =
        SaasSubscriptionStatus.Subscribed;
    }
  }

  private getOrganizationSubscription(
    organization: IOrganization,
    subscriptionRes: ISubscription
  ): ISubscription {
    let dbSubscription;
    const message = `tenantId ${organization.tenantId}, purchaser objectId ${
      subscriptionRes.purchaser.objectId
    } beneficiary objectId ${
      subscriptionRes.beneficiary.objectId
    } dateTime ${new Date().toISOString()}`;
    this._logger.info(
      `[SubscriptionService - isSubScriptionAlreadyAdded] start for ${message}`
    );
    try {
      dbSubscription = organization?.subscriptions?.find(
        (subscription: ISubscription) => subscription.id === subscriptionRes.id
      );
    } catch (error: any) {
      this._logger.error(
        `[SubscriptionService - isSubScriptionAlreadyAdded] error for ${message}, error: ${error.message}`
      );
      throw error;
    }
    this._logger.info(
      `[SubscriptionService - isSubScriptionAlreadyAdded] found subscription for subscription Id ${subscriptionRes.id}, ${message}`
    );
    return dbSubscription;
  }

  private async updateOrganizationSubscriptions(
    organization: IOrganization,
    subscriptionRes: ISubscription
  ) {
    organization.subscriptions = organization?.subscriptions
      ? [...organization.subscriptions, subscriptionRes]
      : [subscriptionRes];
    const updateOrganization =
      await this._organizationRepository.findOneAndUpdate(
        {
          _id: organization._id,
        },
        organization
      );
    return updateOrganization;
  }

  private async getOrCreateOrganization(
    subscriptionRes: ISubscription
  ): Promise<IOrganization> {
    return await this._organizationRepository.findOneAndUpdate<IOrganization>(
      {
        tenantId: subscriptionRes?.purchaser.tenantId,
      },
      { tenantId: subscriptionRes?.purchaser.tenantId }
    );
  }

  private async getOrCreateSubscriptionOwners(subscription: ISubscription) {
    //if purchaser is the same as the beneficiary we will return only one user
    const isPurchaserIsBeneficiary =
      subscription?.purchaser.objectId === subscription?.beneficiary?.objectId;

    const usersQueries = this.prepareFindOwnerQuery(
      isPurchaserIsBeneficiary,
      subscription
    );
    return await this.findOwnerOrCreateUser(usersQueries, subscription);
  }

  private prepareFindOwnerQuery(
    isPurchaserIsBeneficiary: boolean,
    subscription: ISubscription
  ) {
    return isPurchaserIsBeneficiary
      ? [
          {
            userId: subscription?.purchaser.objectId,
            tenantId: subscription?.purchaser.tenantId,
            upn: subscription?.purchaser.emailId,
          },
        ]
      : [
          {
            userId: subscription?.purchaser.objectId,
            tenantId: subscription?.purchaser.tenantId,
            upn: subscription?.purchaser.emailId,
          },
          {
            tenantId: subscription?.beneficiary.tenantId,
            userId: subscription?.beneficiary?.objectId,
            upn: subscription?.beneficiary?.emailId,
          },
        ];
  }

  private async findOwnerOrCreateUser(
    usersQueries: { userId: string; tenantId: string; upn: string }[],
    subscription: ISubscription
  ) {
    const isSubscribe =
      subscription.saasSubscriptionStatus === SaasSubscriptionStatus.Subscribed;
    const owners: IUser[] = [];
    for (let index = 0; index < usersQueries.length; index++) {
      const userQuery = usersQueries[index];
      const userData: IUser = {
        ...userQuery,
        role: isSubscribe ? Role.Admin : Role.Member,
        license: isSubscribe ? subscription.planId : "",
        subscriptionId: isSubscribe ? subscription.id : "",
      };
      const owner: IUser = await this._userRepository.findOneAndUpdate(
        userQuery,
        userData
      );
      if (owner) {
        owners.push(owner);
      }
    }
    return owners;
  }

  private async getSubscriptionDetails(access_token: string, token: string) {
    this._logger.info(
      `[getSubscriptionDetails] started dateTime:${new Date().toISOString()}`
    );
    let subscription: AddSubscription;
    const resolveUrl =
      this._config.subscriptionBaseUrl +
      this._config.resolveSubscriptionEndPoint +
      this._config.fulfillmentApiVersion;
    try {
      subscription =
        await SubscriptionService._httpService.post<AddSubscription>(
          resolveUrl,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${access_token}`,
              "x-ms-marketplace-token": token,
            },
          }
        );
    } catch (error: any) {
      this._logger.error(
        `[getSubscriptionDetails] error ${
          error.message
        } dateTime: ${new Date().toISOString()}`
      );
      throw error;
    }
    this._logger.info(
      `[getSubscriptionDetails] finished dateTime:${new Date().toISOString()}`
    );
    return subscription;
  }

  async callActivateSubscriptionApi(
    subscriptionId: string,
    access_token: string,
    confirmationPayload: ActivateSubscription
  ): Promise<void> {
    const activateUrl: string =
      this._config.subscriptionBaseUrl +
      this._config.activateSubscriptionEndPoint +
      this._config.fulfillmentApiVersion;
    const body = JSON.stringify(confirmationPayload);
    const response = await SubscriptionService._httpService.post<{
      Message: string;
    }>(activateUrl.replace("*{subscriptionId}*", subscriptionId), {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${access_token}`,
      },
      body,
    });
    if (response?.Message) {
      const errorMessage = `[callActivateSubscriptionApi] error for subscriptionId ${subscriptionId} body ${body}, api message ${response.Message}`;
      this._logger.error(errorMessage);
      throw new Error(errorMessage);
    }
  }
}

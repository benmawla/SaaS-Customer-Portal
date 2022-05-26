import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import { OrganizationController, SubscriptionController } from "../controllers";
import { ErrorResponse } from "../entities";
import { AppLoader } from "../utils";

const httpTrigger: AzureFunction = async function (
  context: Context,
  req: HttpRequest
): Promise<void> {
  const { log } = context;
  const { appConfig, isValidRequest } = await AppLoader.initApp(req);
  if (!isValidRequest) {
    context.res = {
      status: 500,
      body: "user not authenticate",
    };
  }
  const organizationController = new OrganizationController(appConfig, log);
  let response = {};
  if (req?.query?.tid) {
    try {
      response = await organizationController.getLicense(req.query.tid);
    } catch (error: any) {
      const errorMessage: ErrorResponse = {
        error: "Something want wrong please try again later",
      };
      context.res = {
        status: 500,
        body: errorMessage,
      };
      return;
    }
  } else {
    const errorMessage: ErrorResponse = {
      error: "Missing tenantId query parameter",
    };
    context.res = {
      status: 404,
      body: errorMessage,
    };
    return;
  }

  context.res = {
    status: 200,
    body: response,
  };
};

export default httpTrigger;

import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import { SubscriptionController } from "../controllers";
import { AppLoader, AuthenticationProvider } from "../utils";

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
  const subscriptionController = new SubscriptionController(appConfig, log);
  if (req?.body?.action === "Unsubscribe") {
    await subscriptionController.unsubscribe(req?.body?.subscription);
  }
  // we need to create a page that calls that api and returns response to user!
  if (req?.query?.token) {
    await subscriptionController.resolveSubscription(req.query.token);
  }

  context.res = {
    status: 200,
    body: "",
  };
};

export default httpTrigger;

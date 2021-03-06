var path = require("path");
var tl = require("vsts-task-lib");
require("shelljs/global");

// Global variables.
var codePushCommandPrefix = "node " + path.join(__dirname, "node_modules", "code-push-cli", "script", "cli");

// Export for unit testing.
function log(message) {
    console.log(message);
}

// Helper functions.
function buildCommand(cmd, positionArgs, optionFlags) {
    var command = codePushCommandPrefix + " " + cmd;

    positionArgs && positionArgs.forEach(function (positionArg) {
        command = command + " \"" + positionArg + "\"";
    });

    for (var flag in optionFlags) {
        // If the value is falsey, the option flag doesn't have to be specified.
        if (optionFlags[flag] || optionFlags[flag] === "") {
            var flagValue = "" + optionFlags[flag];

            command = command + " --" + flag;
            command = command + " \"" + flagValue + "\"";
        }
    }

    return command;
}

function executeCommandAndHandleResult(cmd, positionArgs, optionFlags) {
    var command = buildCommand(cmd, positionArgs, optionFlags);

    var result = exec(command, { silent: true });

    if (result.code == 0) {
        module.exports.log(result.output);
    } else {
        tl.setResult(1, result.output);
        ensureLoggedOut();
        throw new Error(result.output);
    }

    return result;
}

function ensureLoggedOut() {
    exec(buildCommand("logout"), { silent: true });
}

// The main function to be executed.
function performPatchTask(accessKey, appName, deploymentName, label, description, isDisabled, isMandatory, rollout, appStoreVersion) {
    // If function arguments are provided (e.g. during test), use those, else, get user inputs provided by VSTS.
    var authType = tl.getInput("authType", false);
    if (authType === "AccessKey") {
        accessKey = tl.getInput("accessKey", true);
    } else if (authType === "ServiceEndpointCodePush" || authType === "ServiceEndpointHockeyApp") {
        var serviceAccount = tl.getEndpointAuthorization(tl.getInput(authType, true));
        accessKey = serviceAccount.parameters.password;
    }

    appName = appName || tl.getInput("appName", true);
    deploymentName = deploymentName || tl.getInput("deploymentName", true);
    label = label || tl.getInput("releaseLabel", false);
    description = description || tl.getInput("description", false);
    isDisabled = isDisabled || tl.getInput("isDisabled", false);
    isMandatory = isMandatory || tl.getInput("isMandatory", false);
    rollout = rollout || tl.getInput("rollout", false);
    appStoreVersion = appStoreVersion || tl.getInput("appStoreVersion", true);

    if (!accessKey) {
        console.error("Access key required");
        tl.setResult(1, "Access key required");
    }
  
    // Ensure all other users are logged out.
    ensureLoggedOut();
  
    // Log in to the CodePush CLI.
    executeCommandAndHandleResult("login", /*positionArgs*/ null, { accessKey: accessKey });
  
    // Run release command.
    executeCommandAndHandleResult(
        "patch",
        [appName, deploymentName],
        {
            label: (label === "latest" ? false : label),
            description: (description === "noChange" ? false : description),
            disabled: (isDisabled === "noChange" ? false : isDisabled),
            mandatory: (isMandatory === "noChange" ? false : isMandatory),
            rollout: (rollout === "noChange" ? false : rollout),
            targetBinaryVersion: (appStoreVersion === "noChange" ? false : appStoreVersion)
        }
        );
  
    // Log out.
    ensureLoggedOut();
}

module.exports = {
    buildCommand: buildCommand,
    commandPrefix: codePushCommandPrefix,
    ensureLoggedOut: ensureLoggedOut,
    executeCommandAndHandleResult: executeCommandAndHandleResult,
    log: log,
    performPatchTask: performPatchTask
}

if (require.main === module) {
    // Only run the patch task if the script is being run directly, and not imported as a module (eg. during test)
    performPatchTask();
}

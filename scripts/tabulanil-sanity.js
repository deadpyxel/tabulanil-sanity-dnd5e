/**
 * Class representing the sanity system for the FoundryVTT module
 */
class TabulanilSanity {
  /**
   * The unique identifier for the module
   * @type {string}
   */
  static ID = "tabulanil-sanity-dnd5e";

  /**
   * Static flag path for the module
   * @type {string}
   */
  static flagPath = `flags.${this.ID}`;

  /**
   * Flags used within the module to maintain state
   * @type {Object}
   */
  static FLAGS = {
    CURRENT_SANITY: "currSanity",
  }

  /**
   * Mapping of custom Hooks for the modules
   * @type {Object}
   */
  static HOOKS = {
    INSANITY_CHANGE: `${this.ID}.insanityTierChanged`,
  }

  /**
   * Mapping of templates used in the module
   * @type {Object}
   */
  static TEMPLATES = {
    CHAT_MESSAGE: `modules/${this.ID}/templates/chat-card.hbs`
  }

  /**
   * Settings used within the module.
   * @type {Object}
   */
  static SETTINGS = {
    INJECT_BUTTON: "injectButton",
    HUD_ENABLE: "tokenHUDEnable",
    PUBLIC_NOTIFICATION: "publicSanMsg",
  }

  /**
   * Logs messages to the console if the debug mode is active or logging is forced.
   * @param {boolean} force - Force the function to log regardless of the debug settings
   * @param {...any} args - Additional arguments to log.
   */
  static log(force, ...args) {
    const shouldLog = force || game.modules.get('_dev-mode')?.api?.getPackageDebugValue(this.ID);

    if (shouldLog) {
      console.log(this.ID, '|', ...args);
    }
  }

  /**
   * Register the settings for the module
   */
  static registerSettings() {
    // Setting to show Sanity Bar on Actor sheet, defaults to true
    game.settings.register(
      this.ID, this.SETTINGS.INJECT_BUTTON, {
        name: `TABULANIL_SANITY.settings.${this.SETTINGS.INJECT_BUTTON}.Name`, // Setting name
        default: true, // default value
        type: Boolean, // Type of setting
        scope: "world", // scope of setting, either world (only changed by GM) or client (changeable by player, client only)
        config: true, // show on settings page
        hint: `TABULANIL_SANITY.settings.${this.SETTINGS.INJECT_BUTTON}.Hint`, // extra information for setting
      }
    );
    // Setting to show TokenHUD element to control sanity, defaults to true
    game.settings.register(
      this.ID, this.SETTINGS.HUD_ENABLE, {
        name: `TABULANIL_SANITY.settings.${this.SETTINGS.HUD_ENABLE}.Name`, // Setting name
        default: true, // default value
        type: Boolean, // Type of setting
        scope: "world", // scope of setting, either world (only changed by GM) or client (changeable by player, client only)
        config: true, // show on settings page
        hint: `TABULANIL_SANITY.settings.${this.SETTINGS.HUD_ENABLE}.Hint`, // extra information for setting
      }
    );
    // Setting to show insanity Tier messages in public chat, defaults to whisper.
    game.settings.register(
      this.ID, this.SETTINGS.PUBLIC_NOTIFICATION, {
        name: `TABULANIL_SANITY.settings.${this.SETTINGS.PUBLIC_NOTIFICATION}.Name`, // Setting name
        default: false, // default value
        type: Boolean, // Type of setting
        scope: "world", // scope of setting, either world (only changed by GM) or client (changeable by player, client only)
        config: true, // show on settings page
        hint: `TABULANIL_SANITY.settings.${this.SETTINGS.PUBLIC_NOTIFICATION}.Hint`, // extra information for setting
      }
    );
  }

  /**
   * Initialize module Settings
   */
  static initialize() {
    this.registerSettings();
  }
}

/**
 * Class responsible for managing sanity data computations for Actors
 */
class TabulanilSanityData {

  /**
   * Gets the current Sanity points for the specified actor.
   *
   * @param {Actor} actor - The actor whose current sanity we want to fetch
   * @returns {number} The current Sanity Points of the actor if available, or null otherwise
   */
  static getSanityForActor(actor) {
    return actor.getFlag(TabulanilSanity.ID, TabulanilSanity.FLAGS.CURRENT_SANITY);
  }

  /**
   * Gets the Total Sanity score for the specified actor.
   *
   * @param {Actor} actor - The actor whose sanity total we want to fetch
   * @returns {number} The current Total Sanity Points of the actor if available, or null otherwise
   */
  static getTotalSanityForActor(actor) {
    return this.calcTotalSanityForActor(actor);
  }

  /**
   * Gets the current insanity tier for the specified actor.
   *
   * @param {Actor} actor - The actor whose insanity tier we want to query
   * @returns {number} The current insanity tier of the actor if available, or null otherwise
   */
  static getInsanityTierForActor(actor) {
    const totalSan = this.calcTotalSanityForActor(actor);
    const currSan = this.getSanityForActor(actor);
    const sanPerc = currSan / totalSan;
    return this._calcInsanityTier(sanPerc, TabulanilSanityConfig.getTierCoef());
  }

  /**
   * Calculates the total sanity points for a specified Actor based on their mental ability scores.
   *
   * @param {Actor} actor - The actor whose sanity total we want to calculate
   * @param {Object} [extraData={}] - Optional object containing updated ability scores.
   * @returns {Promise} A Promise that resolves when the actor's Sanity flag is updated.
   */
  static calcTotalSanityForActor(actor, extraData = {}) {
    const actorAbilities = actor.system.abilities
    // For each of the mental attributes, use the new data if it exists, else fetch the actor's current value
    const chaValue = extraData.system?.abilities?.cha?.value || actorAbilities.cha.value;
    const intValue = extraData.system?.abilities?.int?.value || actorAbilities.int.value;
    const wisValue = extraData.system?.abilities?.wis?.value || actorAbilities.wis.value;
    return (chaValue + intValue + wisValue) * 2;
  }

  /**
   * Updates the sanity score for a specified actor.
   *
   * @param {Actor} actor - The actor whose sanity total we want to update
   * @param {number} value - The value to adjust the actor's sanity to.
   * @returns {Promise} A Promise that resolves when the actor's Current Sanity flag is updated.
   */
  static updateSanityForActor(actor, value) {
    TabulanilSanity.log(false, `Setting current sanity for actor ${actor.name} to ${value}`)
    return actor.setFlag(TabulanilSanity.ID, TabulanilSanity.FLAGS.CURRENT_SANITY, value);
  }

  /**
   * Calculates the insanity tier based on the sanity percentage and coefficient values.
   *
   * @param {number} sanPerc - The percentage of current sanity to total sanity
   * @param {number[]} coef - The coefficient values for determining insanity tiers
   * @returns {number} The calculated insanity tier
   */
  static _calcInsanityTier(sanPerc, coef) {
    if (sanPerc === 1.0) {
      return 0;
    }
    let currTier = 0;
    for (let i = 0; i < coef.length; i++) {
      if (sanPerc > coef[i]) {
        break;
      }
      currTier = i + 1;
    }
    return currTier;
  }

  /**
   * Clamps the value between 0 and the maximum sanity value for the actor.
   * @param {number} value - The value to be clamped.
   * @param {Actor} actor - The actor object.
   * @returns {number} The clamped value.
   */
  static _clampValue(value, actor) {
    const maxSan = TabulanilSanityData.getTotalSanityForActor(actor);
    return Math.max(0, Math.min(value, maxSan));
  }

  /**
   * Updates the sanity flags for a specified actor with the provided data.
   *
   * @param {Actor} actor - The actor whose sanity flags we want to update
   * @param {Object} updateData - The data to update the actor flags with
   */
  static async updateSanityFlagsForActor(actor, updateData) {
    const prevTier = TabulanilSanityData.getInsanityTierForActor(actor)
    await actor.update({
      [TabulanilSanity.flagPath]: updateData
    });
    const newTier = TabulanilSanityData.getInsanityTierForActor(actor)
    // Trigger a custom Hook in case there was a change in the insanity tier
    if (prevTier != newTier) {
      Hooks.callAll(TabulanilSanity.HOOKS.INSANITY_CHANGE, {
        prevTier,
        newTier
      }, actor)
    }
  }
}

/**
 * Class representing the configuration for the module.
 */
class TabulanilSanityConfig {

  /**
   * Returns an array of tier coefficients.
   * @returns {number[]} An array of tier coefficients.
   */
  static getTierCoef() {
    // TODO: Make this configurable
    return [0.8, 0.6, 0.4, 0.2, 0.1, 0.0];
  }

  /**
   * Initializes sanity values for the actor.
   * @param {object} actor - The actor object.
   */
  static initializeSanityValuesForActor(actor) {
    TabulanilSanity.log(false, "Initializing module flags");
    const totalSanity = TabulanilSanityData.calcTotalSanityForActor(actor);

    const actorSan = {
      [TabulanilSanity.FLAGS.CURRENT_SANITY]: totalSanity,
    };

    TabulanilSanityData.updateSanityFlagsForActor(actor, actorSan);
  }

  /**
   * Toggles the edit mode for HP.
   * @param {Event} event - The event triggering the edit.
   * @param {boolean} edit - Flag indicating edit mode.
   */
  static _toggleEditHP(event, edit) {
    const target = event.currentTarget.closest(".sanity-points");
    const label = target.querySelector(":scope > .label");
    const input = target.querySelector(":scope > input");
    label.hidden = edit;
    input.hidden = !edit;
    if (edit) {
      input.focus();
    }
  }
}

/**
 * Once the game has initialized, set up our module
 */
Hooks.once('init', () => {
  TabulanilSanity.initialize();
});

/**
 * Registers a debug flag for the module once the developer mode is ready.
 * This is useful for enabling or disabling debug output conditionally based on the environment.
 */
Hooks.once("devModeReady", ({
  registerPackageDebugFlag
}) => {
  registerPackageDebugFlag(TabulanilSanity.ID);
});

/**
 * Hook that enhances the rendered actor sheet for 5e characters by adding custom sanity tracking UI.
 * This function is triggered whenever an actor sheet is rendered in the game.
 * It retrieves sanity-related data for the actor, calculates the sanity percentage,
 * and injects a custom HTML block to display this information.
 *
 * @param {Object} app - The application object representing the actor sheet.
 * @param {HTMLElement[]} html - The HTML element array of the actor sheet.
 * @param {Object} data - The data object associated with the actor.
 */
Hooks.on("renderActorSheet5eCharacter", (app, [html], data) => {
  if (!game.settings.get(TabulanilSanity.ID, TabulanilSanity.SETTINGS.INJECT_BUTTON)) {
    TabulanilSanity.log(false, "Sanity bar visibility is off");
    return;
  }
  const actor = app.document;
  TabulanilSanity.log(false, `Opened actor sheet for ${actor.name}`);

  let currSanity = TabulanilSanityData.getSanityForActor(actor);
  if (currSanity === undefined) {
    TabulanilSanity.log(false, `Module flags were not set for actor ${actor.name}(ID: ${actor.id})`);
    TabulanilSanityConfig.initializeSanityValuesForActor(actor);
  }

  const totalSanity = TabulanilSanityData.calcTotalSanityForActor(actor);
  if (totalSanity <= 0) {
    TabulanilSanity.log(false, "Total Sanity calculated is <= 0, skipping doing nothing...")
    return;
  }
  if (currSanity > totalSanity || currSanity < 0) {
    TabulanilSanity.log(false, "Current sanity is out of bounds, clamping between 0 and total sanity")
    currSanity = TabulanilSanityData._clampValue(currSanity, actor);
    TabulanilSanityData.updateSanityForActor(actor, currSanity);
  }
  const sanPerc = currSanity / totalSanity * 100;
  const currInsanityTier = TabulanilSanityData.getInsanityTierForActor(actor);

  const insanityTierName = game.i18n.localize(`TABULANIL_SANITY.insanityTiers.TIER_${currInsanityTier}.shortName`);
  const insanityTierFlavour = game.i18n.localize(`TABULANIL_SANITY.insanityTiers.TIER_${currInsanityTier}.flavourText`);
  const currSanityFlag = `${TabulanilSanity.flagPath}.${TabulanilSanity.FLAGS.CURRENT_SANITY}`
  const tooltipRich = `<section class='dnd5e2 content tabulanil-tooltip tabulanil-rule-tooltip'>
    <section class='header'>
        <h2>${insanityTierName}</h2>
        <ul class='pills'>
            <li class='pill skill'>Tier ${currInsanityTier}</li>
        </ul>
    </section>
    <section class='description'>${insanityTierFlavour}</section>
</section>`

  const sanityUI = `<div class="meter-group">
      <div class="label roboto-condensed-upper">
        <span>Sanity Points</span>
      </div>
      <div class="meter sectioned hit-points sanity-points">
        <div class="progress hit-points sanity-points" role="meter" aria-valuemin="0" aria-valuenow="${currSanity}" aria-valuemax="${totalSanity}" style="--bar-percentage: ${sanPerc}%">
          <div class="label">
            <span class="value">${currSanity}</span>
            <span class="separator">/</span>
            <span class="max">${totalSanity}</span>
          </div>
          <input type="text" name="${currSanityFlag}" data-dtype="Number" placeholder="0" value="${currSanity}" hidden="">
        </div>
        <div class="tmp sanity-tier" data-tooltip="${tooltipRich}">
          <span>${currInsanityTier}</span>
        </div>
      </div>
    </div>`

  const actorSheetLocation = html.querySelector("div.stats > div:nth-child(4)");
  if (actorSheetLocation) {
    actorSheetLocation.insertAdjacentHTML("afterend", sanityUI);
  }

  // add event listener to sanity bar
  const sanityBar = html.querySelector("div.progress.hit-points.sanity-points");
  sanityBar.addEventListener("click", (event) => {
    TabulanilSanity.log(false, "clicked on sanity bar:", event);
    TabulanilSanityConfig._toggleEditHP(event, true);
  });
  const sanityBarInput = html.querySelector(`input[name="${currSanityFlag}"]`);
  sanityBarInput.addEventListener("blur", (event) => {
    TabulanilSanity.log(false, "focus out of input", event);
    TabulanilSanityConfig._toggleEditHP(event, false);
  });
});


/** Hook that adds the Sanity controls to the TokenHUD
 * Can be disabled in module settings.
 *
 * @param {TokenHUD} app
 * @param {JQuery} html
 * @param {Object} context
 */
Hooks.on("renderTokenHUD", (app, [html], context) => {
  if (!game.settings.get(TabulanilSanity.ID, TabulanilSanity.SETTINGS.HUD_ENABLE)) {
    TabulanilSanity.log(false, "Sanity HUD control visibility is off");
    return;
  }
  const actor = game.actors.get(context.actorId);
  const currSanity = TabulanilSanityData.getSanityForActor(actor)
  const currSanityFlag = `${TabulanilSanity.flagPath}.${TabulanilSanity.FLAGS.CURRENT_SANITY}`
  const sanityBarHTML = `<div class="attribute tabulanil-bar"><input type="text" name="${currSanityFlag}" value="${currSanity}"></div>`

  const bar1 = html.querySelector("#token-hud > div.col.middle > div.attribute.bar1");
  bar1.insertAdjacentHTML("afterend", sanityBarHTML);

  const sanInput = html.querySelector("div.attribute.tabulanil-bar > input[type=text]");
  // select contents on the sanity input
  sanInput.addEventListener("click", (event) => {
    event.currentTarget.select();
  });
  // unfocus the input on "Submit"
  sanInput.addEventListener("keydown", (event) => {
    if (event.code === "Enter" || event.code === "NumpadEnter") {
      event.currentTarget.blur();
    }
  });
  // listen to focus remove and update current sanity
  sanInput.addEventListener("focusout", (event) => {
    // Acquire string input
    const input = event.currentTarget;
    let strVal = input.value.trim();
    // IF we are using a delta style input
    let isDelta = strVal.startsWith("+") || strVal.startsWith("-");
    if (strVal.startsWith("=")) strVal = strVal.slice(1);
    // Evaluate value as number
    let value = Number(strVal);

    let currSanity = TabulanilSanityData.getSanityForActor(actor);
    currSanity = isDelta ? currSanity + value : value;
    currSanity = TabulanilSanityData._clampValue(currSanity, actor);

    const actorSan = {
      [TabulanilSanity.FLAGS.CURRENT_SANITY]: currSanity,
    };

    TabulanilSanityData.updateSanityFlagsForActor(actor, actorSan);
  });
});

/**
 * Handle the event when the insanity tier changes for an actor.
 * @param {object} insanityChanges - The changes in insanity tier.
 * @param {Actor} actor - The actor whose insanity tier changed.
 */
Hooks.on(TabulanilSanity.HOOKS.INSANITY_CHANGE, (insanityChanges, actor) => {
  TabulanilSanity.log(false, "Insanity tier changed");
  const {
    newTier,
    prevTier
  } = insanityChanges;

  /**
   * Async wrapper to post a message in the chat.
   * @param {object} data - The data to be posted in the chat message.
   */
  const postMessage = async (data) => {
    const messageData = {
      // render chat message using custom template
      content: await renderTemplate(TabulanilSanity.TEMPLATES.CHAT_MESSAGE, data),
      // Change speaker field
      speaker: ChatMessage.implementation.getSpeaker({
        actor: actor,
        alias: game.i18n.localize("TABULANIL_SANITY.moduleSpeaker")
      })
    }
    // If message notification are set to not set to public we use whispers instead
    if (!game.settings.get(TabulanilSanity.ID, TabulanilSanity.SETTINGS.PUBLIC_NOTIFICATION)) {
      TabulanilSanity.log(false, "Insanity Tier changes are set to public");
      // whisper message to owners of the actor
      messageData.whisper = game.users.filter(u => actor.testUserPermission(u, "OWNER")).map(u => u.id)
    }

    await getDocumentClass("ChatMessage").create(messageData);
  };

  const insanityTierName = game.i18n.localize(`TABULANIL_SANITY.insanityTiers.TIER_${newTier}.shortName`);
  const insanityTierFlavour = game.i18n.localize(`TABULANIL_SANITY.insanityTiers.TIER_${newTier}.flavourText`);
  const msgData = {
    description: insanityTierFlavour,
    iconURL: `modules/${TabulanilSanity.ID}/assets/icon.svg`,
    note: `<i>Insanity Tier for <b>${actor.name}</b> changed from <b>${prevTier}</b> to <b>${newTier}</b></i>`,
    title: `TIER ${newTier} - ${insanityTierName}`,
  }

  postMessage(msgData);
});

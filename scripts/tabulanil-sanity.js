/**
  * Class representing the sanity system for the FoundryVTT module
  */
class TabulanilSanity {
  /**
  * The unique identifier for the module
  * @type {string}
  */
  static ID = "tabulanil-sanity-dnd5e";

  static flagPath = `flags.${this.ID}`;

  /**
  * Flags used within the module to maintain state
  * @type {Object}
  */
  static FLAGS = {
    CURRENT_SANITY: "currSanity",
  }

  /**
   * Settings used within the module.
   * @type {Object}
   */
  static SETTINGS = {
    INJECT_BUTTON: "injectButton"
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
   * Initialize module Settings
   */
  static initialize() {
    game.settings.register(
      this.ID, this.SETTINGS.INJECT_BUTTON, {
        name: `TABULANIL_SANITY.settings.${this.SETTINGS.INJECT_BUTTON}.Name`, // Setting name
        default: true, // default value
        type: Boolean, // Type of setting
        scope: "world", // scope of setting, either world (only changed by GM) or client (changeable by player, client only)
        config: true, // show on settings page
        hint: `TABULANIL_SANITY.settings.${this.SETTINGS.INJECT_BUTTON}.Hint`, // estra information for setting
      }
    );
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
    const sanPerc = currSan/totalSan;
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

  static _clampValue(value, actor) {
    const maxSan = TabulanilSanityData.getTotalSanityForActor(actor);
    return Math.max(0, Math.min(value, maxSan));
  }

  /**
  * Updates the sanity flags for a specified actor with the provided data.
  *
  * @param {Actor} actor - The actor whose sanity flags we want to update
  * @param {Object} updateData - The data to update the sanity flags with
  */
  static updateSanityFlagsForActor(actor, updateData) {
    const flagPath = `flags.${TabulanilSanity.ID}`;
    actor.update({ [flagPath]: updateData });
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
Hooks.once("devModeReady", ({ registerPackageDebugFlag }) => {
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
  if (currSanity === undefined ) {
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
  const actor = game.actors.get(context.actorId);
  const currSanity = TabulanilSanityData.getSanityForActor(actor)
  const currSanityFlag = `${TabulanilSanity.flagPath}.${TabulanilSanity.FLAGS.CURRENT_SANITY}`
  const sanityBar = `<div class="attribute tabulanil-bar"><input type="text" name="${currSanityFlag}" value="${currSanity}"></div>`

  const bar1 = html.querySelector("#token-hud > div.col.middle > div.attribute.bar1");
  bar1.insertAdjacentHTML("afterend", sanityBar);

  const sanBar = html.querySelector("div.attribute.tabulanil-bar > input[type=text]");
  // select contents on the sanity input
  sanBar.addEventListener("click", (event) => {
    event.currentTarget.select();
  });
  // unfocus the input on "Submit"
  sanBar.addEventListener("keydown", (event) => {
    if (event.code === "Enter" || event.code === "NumpadEnter") {
      event.currentTarget.blur();
    }
  });
  // listen to focus remove and update current sanity
  sanBar.addEventListener("focusout", (event) => {
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

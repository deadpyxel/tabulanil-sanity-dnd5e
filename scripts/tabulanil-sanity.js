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
}

/**
  * Class responsible for managing sanity data computations for Actors
  */
class TabulanilSanityData {

  /**
  * Gets the current Sanity points for the specified actor.
  *
  * @param {Actor} actor - The actor whose current sanity we want to fetch
  * @returns {number|null} The current Sanity Points of the actor if available, or null otherwise
  */
  static getSanityForActor(actor) {
    return actor.getFlag(TabulanilSanity.ID, TabulanilSanity.FLAGS.CURRENT_SANITY);
  }

  /**
  * Gets the Total Sanity score for the specified actor.
  *
  * @param {Actor} actor - The actor whose sanity total we want to fetch
  * @returns {number|null} The current Total Sanity Points of the actor if available, or null otherwise
  */
  static getTotalSanityForActor(actor) {
    return this.calcTotalSanityForActor(actor);
  }
  /**
  * Gets the current insanity tier for the specified actor.
  *
  * @param {Actor} actor - The actor whose insanity tier we want to query
  * @returns {number|null} The current insanity tier of the actor if available, or null otherwise
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


  static updateSanityFlagsForActor(actor, updateData) {
    const flagPath = `flags.${TabulanilSanity.ID}`;
    actor.update({ [flagPath]: updateData });
  }
}

class TabulanilSanityConfig {

  static getTierCoef() {
    return [0.8, 0.6, 0.4, 0.2, 0.1, 0.0];
  }

  static initializeSanityValuesForActor(actor) {
    TabulanilSanity.log(false, "Initializing module flags")
    const totalSanity = TabulanilSanityData.calcTotalSanityForActor(actor);

    const actorSan = {
      [TabulanilSanity.FLAGS.CURRENT_SANITY]: totalSanity,
    };

    TabulanilSanityData.updateSanityFlagsForActor(actor, actorSan)
  }

  static _toggleEditHP(event, edit) {
    const target = event.currentTarget.closest(".sanity-points");
    const label = target.querySelector(":scope > .label");
    const input = target.querySelector(":scope > input");
    label.hidden = edit
    input.hidden = !edit
    if (edit) {
      input.focus();
    }
  }
}

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
  const actor = app.document;
  TabulanilSanity.log(false, `Opened actor sheet for ${actor.name}`);

  if (!actor.getFlag(TabulanilSanity.ID, TabulanilSanity.FLAGS.CURRENT_SANITY)) {
    TabulanilSanity.log(false, `Module flags were not set for actor ${actor.name}(ID: ${actor.id})`);
    TabulanilSanityConfig.initializeSanityValuesForActor(actor);
  }

  const totalSanity = TabulanilSanityData.calcTotalSanityForActor(actor);
  if (totalSanity <= 0) {
    return;
  }
  const currSanity = TabulanilSanityData.getSanityForActor(actor);
  const sanPerc = currSanity / totalSanity * 100;
  const currInsanityTier = TabulanilSanityData.getInsanityTierForActor(actor);

  const insanityTierName = game.i18n.localize(`TABULANIL_SANITY.TIER_${currInsanityTier}.shortName`);
  const insanityTierFlavour = game.i18n.localize(`TABULANIL_SANITY.TIER_${currInsanityTier}.flavourText`);
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

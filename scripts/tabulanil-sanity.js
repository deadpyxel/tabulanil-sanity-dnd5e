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
  * Flags used within the module to maintain state
  * @type {Object}
  */
  static FLAGS = {
    SANITY_POOL: "totalSanity",
    CURRENT_SANITY: "currSanity",
    INSANITY_TIER: "insanityTier",
  }

  /**
  * Paths to the Handlebars tempalte files used
  * @type {Object}
  */
  static TEMPLATES = {
    SANITYSHEET: `modules/${this.ID}/templates/sanity-system.hbs`
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


  static _calcTotalSanity(charisma, intelligence, wisdom) {
    return (charisma + intelligence + wisdom) * 2
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
    const totalSanity = this._calcTotalSanity(chaValue, intValue, wisValue);
    return actor.setFlag(TabulanilSanity.ID, TabulanilSanity.FLAGS.SANITY_POOL, totalSanity);
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
    return actor.getFlag(TabulanilSanity.ID, TabulanilSanity.FLAGS.SANITY_POOL);
  }
  /**
  * Gets the current insanity tier for the specified actor.
  *
  * @param {Actor} actor - The actor whose insanity tier we want to query
  * @returns {number|null} The current insanity tier of the actor if available, or null otherwise
  */
  static getInsanityTierForActor(actor) {
    return actor.getFlag(TabulanilSanity.ID, TabulanilSanity.FLAGS.INSANITY_TIER);
  }
  /**
  * Updates the insanity tier for a specified actor.
  *
  * @param {string} actorId - The unique identifier for the actor whose insanity tier we want to update
  * @returns {Promise} A Promise that resolves when the actor's Insanity Tier flag is updated.
  */
  static updateCurrentInsanityTierForActor(actor) {
      const currSan = actor.getFlag(TabulanilSanity.ID, TabulanilSanity.FLAGS.CURRENT_SANITY);
      const totalSan = actor.getFlag(TabulanilSanity.ID, TabulanilSanity.FLAGS.SANITY_POOL);
      const sanityTier = this.calcSanityTier(totalSan, [0.8, 0.6, 0.4, 0.2, 0.1, 0.0], currSan);
      TabulanilSanity.log(false, `Current Insanity Tier for actor ${actor.name}[${actor.id}]: ${sanityTier}`);
      return actor.setFlag(TabulanilSanity.ID, TabulanilSanity.FLAGS.INSANITY_TIER, sanityTier);
  }

  /**
   * Calculates the sanity tier based on the provided base value, a lost of coefficients and the current value.
   * The function determines the highest applicable tier where the current value is greater then or equal the
   * base value multiplied by the coefficient of that tier. It returns the tier number starting from 1.
   * If the current value is greater than the first tier or equal to the base value, returns 0.
   *
   * @param {number} baseVal - The base value for sanity calculation.
   * @param {Array<number>} coef - An array of coefficients used to determine tier thresholds for sanity.
   * @param {number} currVal - The current sanity value to be compared.
   * @returns {number} The 1-based index of the highest matching tier or 0 if no tier is valid
   */
  static calcSanityTier(baseVal, coef, currVal) {
    if (baseVal <= 0) {
      return 0
    }
    const sanPerc = currVal/baseVal
    let currTier = 0;
    for (let i = 0; i < coef.length; i++) {
      if (sanPerc > coef[i]) {
        break;
      }
      currTier = i + 1;
    }
    return currTier;
  }
}

class TabulanilSanityConfig {

  static initializeSanityValuesForActor(actor) {
    const {cha, int, wis} = actor.system?.abilities;
    const totalSanity = TabulanilSanityData._calcTotalSanity(cha.value, int.value, wis.value);

    const actorSan = {
      totalSanity: totalSanity,
      currSanity: totalSanity,
      insanityTier: 0,
    };
    const flagPath = `flags.${TabulanilSanity.ID}`;
    TabulanilSanity.log(false, "module flag: ", flagPath)

    TabulanilSanity.log(false, "current actor stuff: ", actorSan);
    actor.update({"flags.tabulanil-sanity-dnd5e": actorSan});


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

  if (!actor.getFlag(TabulanilSanity.ID, TabulanilSanity.FLAGS.SANITY_POOL)) {
    TabulanilSanity.log(false, `Module flags were not set for actor ${actor.name}(ID: ${actor.id})`);
    TabulanilSanityConfig.initializeSanityValuesForActor(actor);
  }

  const totalSanity = TabulanilSanityData.getTotalSanityForActor(actor);
  const currSanity = TabulanilSanityData.getSanityForActor(actor);
  const currInsanityTier = TabulanilSanityData.getInsanityTierForActor(actor);
  if (totalSanity <= 0) {
    return;
  }
  const sanPerc = currSanity / totalSanity * 100;

  const insanityTierName = game.i18n.localize(`TABULANIL_SANITY.TIER_${currInsanityTier}.shortName`);
  const insanityTierFlavour = game.i18n.localize(`TABULANIL_SANITY.TIER_${currInsanityTier}.flavourText`);
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
          <input type="text" name="flags.tabulanil-sanity-dnd5e.currSanity" data-dtype="Number" placeholder="0" value="${currSanity}" hidden="">
        </div>
        <div class="tmp sanity-tier" data-tooltip="${tooltipRich}">
          <span>${currInsanityTier}</span>
        </div>
      </div>
    </div>`

  const actorSheetLocation = html.querySelector(`#ActorSheet5eCharacter2-Actor-${actor.id} > section > form > section.sheet-body > div > div > div.card > div.stats > div:nth-child(4)`);
  if (actorSheetLocation) {
    actorSheetLocation.insertAdjacentHTML("afterend", sanityUI);
  }
});


Hooks.on("preUpdateActor", (actor, data, info, id) => {
  if (data.system?.abilities?.int || data.system?.abilities?.wis || data.system?.abilities?.cha) {
    TabulanilSanity.log(false, "Mental attributes changed, updating data flags");
    TabulanilSanityData.calcTotalSanityForActor(actor, data);
    TabulanilSanityData.updateCurrentInsanityTierForActor(actor);
  }
});

// Hooks.on("preCreateActor", (actor, actorMeta, actorOps, id) => {
//   TabulanilSanity.log(false, "New Actor created, populating flags");
//   TabulanilSanityData.calcTotalSanityForActor(actor);
//   TabulanilSanityData.updateCurrentInsanityTierForActor(actor);
//   TabulanilSanityData.updateSanityForActor(actor, TabulanilSanityData.getTotalSanityForActor(actor));
// });

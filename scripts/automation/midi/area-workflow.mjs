let cached;

// Midi 14 preserves a supplied workflow only if it is a TrapWorkflow instance.
// Construct its normal Workflow base directly: Trap's constructor would start a
// second activity use. Keep normal stages except the save-before-damage ordering.
export function getAreaWorkflowClass() {
  const api = globalThis.MidiQOL;
  if (!api?.Workflow || !api?.TrapWorkflow) throw Error("Нужен Midi-QOL с поддержкой Workflow и TrapWorkflow.");
  if (cached?.base === api.Workflow) return cached.type;
  const trap = api.TrapWorkflow.prototype, base = api.Workflow.prototype;
  class GrimoireAreaWorkflow extends api.TrapWorkflow {
    constructor(...args) { return Reflect.construct(api.Workflow, args, new.target); }
    static get forceCreate() { return api.Workflow.forceCreate; }
    get workflowType() { return "BaseWorkflow"; }
    async WorkflowState_Start(context = {}) { return base.WorkflowState_Start.call(this, context); }
    async WorkflowState_AwaitTemplate(context = {}) { return base.WorkflowState_AwaitTemplate.call(this, context); }
    async WorkflowState_TemplatePlaced(context = {}) { return base.WorkflowState_TemplatePlaced.call(this, context); }
    async WorkflowState_ValidateRoll(context = {}) { return base.WorkflowState_ValidateRoll.call(this, context); }
    async WorkflowState_AttackRollComplete(context = {}) { return base.WorkflowState_AttackRollComplete.call(this, context); }
    async WorkflowState_RollFinished(context = {}) { return base.WorkflowState_RollFinished.call(this, context); }
    setDescriptorACModifiers(...args) { return base.setDescriptorACModifiers?.apply(this, args); }
    async WorkflowState_WaitForAttackRoll(context = {}) {
      if (this.activity.hasAttack || this.activity.attack) return base.WorkflowState_WaitForAttackRoll.call(this, context);
      this.hitTargets = new Set(this.targets); this.hitTargetsEC = new Set();
      return this.WorkflowState_WaitForSaves;
    }
    async WorkflowState_WaitForSaves(context = {}) {
      await this.callMidiHooks("midi-qol.preCheckSaves");
      if (this.aborted) return this.WorkflowState_Abort;
      this.activity.saveDisplay = "allShow";
      return trap.WorkflowState_WaitForSaves.call(this, context);
    }
    async checkSaves(...args) {
      const result = await base.checkSaves.apply(this, args);
      await this.callMidiHooks("midi-qol.postCheckSaves");
      return result;
    }
    async WorkflowState_SavesComplete(context = {}) {
      await base.WorkflowState_SavesComplete.call(this, context);
      if (this.aborted) return this.WorkflowState_Abort;
      return this.activity.hasDamage || this.activity.hasHealing || this.otherActivity?.hasDamage || this.otherActivity?.hasHealing
        ? this.WorkflowState_WaitForDamageRoll : this.WorkflowState_AllRollsComplete;
    }
    async WorkflowState_WaitForDamageRoll(context = {}) {
      if (context.noDamage || !(this.activity.hasDamage || this.activity.hasHealing || this.otherActivity?.hasDamage || this.otherActivity?.hasHealing))
        return this.WorkflowState_AllRollsComplete;
      return base.WorkflowState_WaitForDamageRoll.call(this, context);
    }
    async WorkflowState_DamageRollComplete(context = {}) {
      const next = await base.WorkflowState_DamageRollComplete.call(this, context);
      return next === this.WorkflowState_WaitForSaves ? this.WorkflowState_AllRollsComplete : next;
    }
    async WorkflowState_AllRollsComplete(context = {}) { return base.WorkflowState_AllRollsComplete.call(this, context); }
  }
  cached = { base: api.Workflow, type: GrimoireAreaWorkflow };
  return GrimoireAreaWorkflow;
}

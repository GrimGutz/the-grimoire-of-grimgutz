let cached;

// Reuse Midi's native save-first stages without TrapWorkflow's self-starting,
// incompatible constructor. Resources, rolls, socket requests and damage remain Midi's.
export function getAreaWorkflowClass() {
  const api = globalThis.MidiQOL;
  if (!api?.Workflow || !api?.TrapWorkflow) throw Error("Нужен Midi-QOL с поддержкой Workflow и TrapWorkflow.");
  if (cached?.base === api.Workflow) return cached.type;
  const trap = api.TrapWorkflow.prototype;
  class GrimoireAreaWorkflow extends api.Workflow {
    async WorkflowState_WaitForAttackRoll(context = {}) {
      if (this.activity.hasAttack || this.activity.attack) return super.WorkflowState_WaitForAttackRoll(context);
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
      const result = await super.checkSaves(...args);
      await this.callMidiHooks("midi-qol.postCheckSaves");
      return result;
    }
    async WorkflowState_SavesComplete() { return this.WorkflowState_WaitForDamageRoll; }
    async WorkflowState_DamageRollComplete(context = {}) { return trap.WorkflowState_DamageRollComplete.call(this, context); }
    async WorkflowState_AllRollsComplete(context = {}) { return trap.WorkflowState_AllRollsComplete.call(this, context); }
  }
  cached = { base: api.Workflow, type: GrimoireAreaWorkflow };
  return GrimoireAreaWorkflow;
}

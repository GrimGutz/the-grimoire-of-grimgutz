import { defineContent } from "../shared/content.mjs";
import { inspectIllithid, syncIllithid, validateIllithidAdvancement, validateIllithidItem } from "./illithid.mjs";
import { controlIllithid } from "./illithid-actions.mjs";
import { installIllithidHooks } from "./illithid-events.mjs";
import { applyIllithidPacket } from "./illithid-midi.mjs";
import { useIllithidRefuge } from "./illithid-refuge.mjs";

export const ILLITHID_CONTENT = defineContent({
  id: "illithid",
  kind: "transformation",
  actions: { "illithid-control": controlIllithid },
  itemValidators: [validateIllithidItem],
  advancementValidators: [validateIllithidAdvancement],
  install: installIllithidHooks,
  sync: syncIllithid,
  inspect: inspectIllithid,
  midi: { applyIllithidPacket },
  api: { useIllithidRefuge }
});

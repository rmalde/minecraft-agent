// Compatibility entry point; never inject a second unauthenticated relay into a debugger.
import { startRelay } from '../../model-relay.mjs';
startRelay();

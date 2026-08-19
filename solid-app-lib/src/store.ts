import { reactive, markRaw } from 'vue'
import { UserManager, WebStorageStateStore, type UserManagerSettings } from 'oidc-client-ts'

const OIDC_SETTINGS_KEY = 'loama.oidc.settings';

export interface OidcLoginSettings {
    authority: string;
    clientId: string;
    redirectUrl: string;
    postLogoutRedirectUrl: string;
    scope?: string;
}

function toUserManagerSettings(settings: OidcLoginSettings): UserManagerSettings {
    return {
        authority: settings.authority,
        client_id: settings.clientId,
        redirect_uri: settings.redirectUrl,
        post_logout_redirect_uri: settings.postLogoutRedirectUrl,
        response_type: 'code',
        scope: settings.scope ?? 'openid profile',
        userStore: new WebStorageStateStore({ store: window.localStorage }),
    };
}

function saveOidcSettings(settings: OidcLoginSettings): void {
    window.localStorage.setItem(OIDC_SETTINGS_KEY, JSON.stringify(settings));
}

function loadOidcSettings(): OidcLoginSettings | undefined {
    const raw = window.localStorage.getItem(OIDC_SETTINGS_KEY);
    if (!raw) return;

    try {
        const parsed = JSON.parse(raw) as OidcLoginSettings;
        if (!parsed.authority || !parsed.clientId || !parsed.redirectUrl || !parsed.postLogoutRedirectUrl) {
            return;
        }
        return parsed;
    } catch {
        return;
    }
}

function createManager(settings?: OidcLoginSettings): UserManager | undefined {
    if (!settings) return;
    return new UserManager(toUserManagerSettings(settings));
}

function createRawManager(settings?: OidcLoginSettings): UserManager | undefined {
    const manager = createManager(settings);
    return manager ? markRaw(manager) : undefined;
}

export interface OidcStore {
    oidcSettings?: OidcLoginSettings;
    oidcManager?: UserManager;
    usedPod: string;
    setUsedPod(url: string): void;
    configureOidc(settings: OidcLoginSettings): void;
    getOidcManager(): UserManager;
}

const initialOidcSettings = loadOidcSettings();

const storeState = reactive({
    oidcSettings: initialOidcSettings,
    oidcManager: createRawManager(initialOidcSettings),
    usedPod: '',
    setUsedPod(url: string) {
        this.usedPod = url;
    },
    configureOidc(settings: OidcLoginSettings) {
        this.oidcSettings = settings;
        saveOidcSettings(settings);
        this.oidcManager = createRawManager(settings);
    },
    getOidcManager(): UserManager {
        if (!this.oidcManager) {
            if (!this.oidcSettings) {
                throw new Error('OIDC is not configured. Start login first.');
            }
            this.oidcManager = createRawManager(this.oidcSettings);
        }
        if (!this.oidcManager) {
            throw new Error('OIDC manager could not be created.');
        }
        return this.oidcManager;
    }
}) as OidcStore;

export const store = storeState;

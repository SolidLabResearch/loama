import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import LoginView from '@/views/LoginView.vue'
import { store } from 'loama-app'
import HeaderLayout from '@/components/layouts/HeaderLayout.vue'
import { useControllerStore } from '@/stores/useControllerStore'
import AccessRequest from '@/components/access-requests/AccessRequest.vue'
import AccessGrant from '@/components/access-grants/AccessGrant.vue'
import { clearAuthenticationContext, setAuthenticationContext } from 'loama-controller'

function resolvePodUrl(): string {
    if (store.usedPod) return store.usedPod;
    return store.oidcSettings?.authority ?? '';
}

async function applyAuthenticatedUserState(controllerStore: ReturnType<typeof useControllerStore>, accessToken: string, identifier: string): Promise<void> {
    setAuthenticationContext({ accessToken, identifier });

    const podUrl = resolvePodUrl();
    if (podUrl) {
        store.setUsedPod(podUrl);
        await controllerStore.current.setPodUrl(podUrl);
    }
}

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: `/`,
            name: 'login',
            component: LoginView
        },
        {
            path: "/",
            component: HeaderLayout,
            children: [
                {
                    path: `/home/:filePath(.*)`,
                    name: 'home',
                    component: HomeView
                },
                {
                    path: `/access-requests/`,
                    name: 'access-requests',
                    component: AccessRequest
                },
                {
                    path: '/access-grants/',
                    name: 'access-grants',
                    component: AccessGrant
                }
            ]
        }
    ]
})

router.beforeEach(async (to) => {
    // don't move this call to outside this function, as this function is only ran after app.use pinia has had the change to run
    const controllerStore = useControllerStore();

    try {
        const manager = store.getOidcManager();

        // Handle callback on the original redirect target route.
        if (typeof to.query.code === 'string' && typeof to.query.state === 'string') {
            const callbackUser = await manager.signinRedirectCallback(window.location.href);
            const identifier = String(callbackUser.profile.webid ?? callbackUser.profile.sub ?? '');

            if (!callbackUser.access_token || !identifier) {
                throw new Error('OIDC callback did not return required user claims.');
            }

            await applyAuthenticatedUserState(controllerStore, callbackUser.access_token, identifier);
            return {
                path: to.path,
                query: {},
                hash: to.hash,
            };
        }

        const user = await manager.getUser();
        const isLoggedIn = !!user && !user.expired;

        if (!isLoggedIn) {
            clearAuthenticationContext();
            if (to.name !== 'login') {
                return { name: 'login', query: { next: to.name?.toString() } };
            }
            return;
        }

        const identifier = String(user.profile.webid ?? user.profile.sub ?? '');
        if (!identifier) {
            throw new Error('OIDC user has no usable identifier claim.');
        }

        await applyAuthenticatedUserState(controllerStore, user.access_token, identifier);
    } catch {
        clearAuthenticationContext();
        if (to.name !== 'login') return { name: 'login', query: { next: to.name?.toString() } };
    }
})

export default router

import { createApp } from 'vue'
import AdminApp from './AdminApp.vue'
import naive from "naive-ui";

const app = createApp(AdminApp);
app.use(naive);
app.mount('#app')

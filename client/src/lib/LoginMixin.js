import axios from "axios";

export default {
	data() {
		return {
			loggedIn: false,
		}
	},
	methods: {
		async checkLogin(target) {
			try {
				const resp = await axios.get(`/api/login/${target}`);
				this.loggedIn = resp.data.loggedIn;
			} catch(e) {}
		},
		async performLogin(target, password) {
			try {
				const resp = await axios.post(`/api/login/${target}`, { password });
				this.loggedIn = this.loggedIn || resp.data.success;
			} catch(e) {}
		}
	}
};
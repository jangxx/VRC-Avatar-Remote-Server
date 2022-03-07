import axios from "redaxios";

export default {
	data() {
		return {
			loggedIn: false,
			notFound: false,
			loginError: null,
		}
	},
	methods: {
		async checkLogin(target) {
			try {
				const resp = await axios.get(`/api/login/${target}`);
				this.loggedIn = resp.data.loggedIn;
			} catch(e) {
				if (e.response.status == 404) {
					this.notFound = true;
				}
			}
		},
		async performLogin(target, password) {
			this.loginError = null;

			try {
				const resp = await axios.post(`/api/login/${target}`, { password });
				this.loggedIn = this.loggedIn || resp.data.success;

				if (!resp.data.success) {
					this.loginError = "Login failed (Wrong password)";
				}
			} catch(e) {
				console.log(e.response);
			}
		}
	}
};
<template>
	<div class="dropzone" @drop.prevent="handleDrop" @dragover.prevent>
		<n-empty description="Drop JSON files here" v-if="Object.keys(foundAvatars).length === 0">
			<template #icon>
				<n-icon>
					<IconArrowAltCircleDown />
				</n-icon>
			</template>
		</n-empty>
		<n-space :vertical="true" v-else-if="!loading">
			<n-select
				:options="selectOptions"
				placeholder="Select an avatar"
				:value="selectedAvatar"
				:on-update:value="handleSelect"
				filterable
			/>

			<n-text>You can drop more files as well.</n-text>
		</n-space>
		<n-spin v-else size="large" />
	</div>
</template>

<script>
import { ArrowAltCircleDown } from "@vicons/fa";

export default {
	name: "DropzoneComponent",
	components: {
		IconArrowAltCircleDown: ArrowAltCircleDown,
	},
	data() {
		return {
			foundAvatars: {},
			selectedAvatar: null,
			loading: false,
		};
	},
	computed: {
		selectOptions() {
			return Object.values(this.foundAvatars).map(avatarData => {
				// console.log(avatarData);
				return { label: avatarData.name, value: avatarData.id };
			}).sort((a, b) => a.label.localeCompare(b.label));
		}
	},
	methods: {
		handleSelect(avatarId) {
			this.selectedAvatar = avatarId;
			this.$emit("avatar", this.foundAvatars[avatarId]);
		},
		async handleDrop(evt) {
			const files = evt.dataTransfer.files;
			this.loading = true;

			for (let file of files) {
				try {
					const avatarData = await this.openAvatarFile(file);

					if (avatarData !== null) {
						this.foundAvatars[avatarData.id] = avatarData;
					}
				} catch(e) {
					console.error(e);
				}
			}

			// select the one dropped avatar if only one was dropped
			if (Object.keys(this.foundAvatars).length == 1) {
				this.handleSelect(Object.keys(this.foundAvatars)[0]);
			}

			this.loading = false;
		},
		openAvatarFile(file) {
			return new Promise((resolve, reject) => {
				if (file.type != "application/json") {
					return reject("Not a json file");
				}

				const reader = new FileReader();
				reader.onload = evt => {
					try {
						return resolve(JSON.parse(evt.target.result));
					} catch(e) {
						return reject(e);
					}
				}
				reader.readAsText(file);
			});
		},
	},
}
</script>

<style>
.dropzone {
	box-sizing: border-box;
	background-color: #656565;
	width: 100%;
	height: 100px;
	/* margin: 20px 0px; */
	padding: 20px;
	text-align: center;
}
</style>
<template>
	<div>
		<n-config-provider :theme="darkTheme">
		<n-h1>VRC Remote Admin</n-h1>

		<n-collapse>
			<n-collapse-item title="Add board">
				<n-card>
					<n-button type="primary" @click="addBoard">Create board</n-button>
				</n-card>
			</n-collapse-item>
		</n-collapse>

		<n-divider />

		<n-select :on-update:value="changeBoard" :options="boardSelectOptions" placeholder="Select board"></n-select>

		<div class="spacer"></div>

		<template v-if="currentBoard !== null">
			<n-text>You can open this board under this url: <n-a :href="boardUrl" target="_blank">{{ boardUrl }}</n-a></n-text>

			<n-divider />

			<n-collapse style="margin-bottom: 20px">
				<n-collapse-item title="Rename board">
					<n-card>
						<n-space vertical size="large">
							<n-input v-model:value="currentBoardData.name" placeholder="Board name" />

							<n-space justify="end">
								<n-button :disabled="boards[currentBoard].name == currentBoardData.name" @click="renameBoard">Rename board</n-button>
							</n-space>
						</n-space>
					</n-card>
				</n-collapse-item>
				<n-collapse-item title="Board password">
					<n-card>
						<n-space vertical size="large">
							<n-input v-model:value="currentBoardData.newPassword" placeholder="Board password" />

							<n-text :type="boards[currentBoard].password ? 'success' : 'info'">
								{{ boards[currentBoard].password ? "Password is currently set" : "Password is currently not set" }}
							</n-text>

							<n-space justify="end">
								<n-button :disabled="currentBoardData.newPassword.length == 0" @click="setBoardPassword(currentBoardData.newPassword)">Set password</n-button>
								<n-button type="warning" :disabled="!boards[currentBoard].password" @click="setBoardPassword(null)">Disable password</n-button>
							</n-space>
						</n-space>
					</n-card>
				</n-collapse-item>
			</n-collapse>

			<n-card>
				<n-space vertical size="large">
					<n-text>Drop an avatar OSC JSON file to add it to the board or to update its parameters. You can find these JSON files in a subdirectory of this path (click to select and copy-paste into Windows Explorer):</n-text>

					<n-input readonly size="small" value="%HOMEPATH%\AppData\LocalLow\VRChat\VRChat\OSC" ref="oscPathInput" @click="$refs.oscPathInput.select()"></n-input>
					
					<Dropzone @file="openAvatarFile"></Dropzone>

					<div v-if="droppedAvatar !== null">
						<n-text type="error" v-if="droppedAvatar.error !== null">
							<b>Error while adding avatar</b>: {{ droppedAvatar.error }}
						</n-text>
						<n-text type="info" v-else-if="processedAvatarData !== null">
							Found avatar <b>{{ processedAvatarData.name }}</b> with <b>{{ processedAvatarData.parameters.length }}</b> input parameters.
						</n-text>
					</div>

					<n-button type="primary" v-if="canAddAvatar" @click="addAvatar">Add avatar</n-button>
				</n-space>
			</n-card>

			<n-divider />

			<n-select :on-update:value="changeAvatar" :value="currentAvatar" :options="avatarSelectOptions" placeholder="Select avatar" v-if="avatarSelectOptions.length > 0"></n-select>

			<template v-if="currentAvatar !== null">
				<div class="spacer"></div>

				<template v-if="processedAvatarData !== null && currentAvatar == processedAvatarData.id">
					<n-card>
						<n-h3>Add parameter control</n-h3>

						<n-form>
							<n-form-item label="Label">
								<n-input v-model:value="currentParameterControl.label" placeholder="Name of the control" />
							</n-form-item>
							<n-form-item label="Parameter">
								<n-select v-model:value="currentParameterControl.selectedParameter" placeholder="Select parameter" :options="newControlSelectOptions" />
							</n-form-item>
							<n-form-item label="Control type">
								<n-select v-model:value="currentParameterControl.controlType" placeholder="Select control type" :options="newControlTypeOptions" :disabled="newControlSelectedParameter === null" />
							</n-form-item>
							<n-collapse-transition :show="currentParameterControl.controlType == 'toggle' || currentParameterControl.controlType == 'button'">
								<n-grid v-if="currentParameterControl.controlType == 'button'" :cols="2" :y-gap="10">
									<n-gi :span="2">
										<n-text>
											The button will always toggle between the <i>current</i> value and the <i>set value</i>, but if the server has not received a value for this parameter yet, it needs a default value to reset it to.
											You should set this to the default value configured for the parameter in Unity
										</n-text>
									</n-gi>
									<n-gi>
										<n-form-item label="Default value">
											<n-input-number v-if="newControlSelectedParameter.type == 'Float'" v-model:value="currentParameterControl.defaultValue" size="small" step="0.1" />
											<n-input-number v-if="newControlSelectedParameter.type == 'Int'" v-model:value="currentParameterControl.defaultValue" size="small" />
											<n-checkbox v-if="newControlSelectedParameter.type == 'Bool'" v-model:checked="currentParameterControl.defaultValue" />
										</n-form-item>
									</n-gi>
									<n-gi>
										<n-form-item label="Set value">
											<n-input-number 
												v-if="newControlSelectedParameter.type == 'Float' || newControlSelectedParameter.type == 'Int'" 
												v-model:value="currentParameterControl.setValue" 
												size="small"
											/>
											<n-checkbox v-else v-model:checked="currentParameterControl.setValue" />
										</n-form-item>
									</n-gi>
								</n-grid>

								<n-form-item label="Value to toggle" v-if="currentParameterControl.controlType == 'toggle'">
									<n-input-number 
										v-if="newControlSelectedParameter.type == 'Float' || newControlSelectedParameter.type == 'Int'" 
										v-model:value="currentParameterControl.setValue" 
										size="small"
									/>
									<n-checkbox v-else v-model:checked="currentParameterControl.setValue" />
								</n-form-item>
							</n-collapse-transition>
						</n-form>

						<n-button type="primary" :disabled="!canAddParameterControl" @click="addParameterControl">
							<template #icon>
								<n-icon>
									<Plus />
								</n-icon>
							</template>Add
						</n-button>
					</n-card>

					<n-divider />
				</template>

				<n-space v-if="currentAvatarData !== null" vertical size="large">
					<n-card v-for="control in currentAvatarData.controls" :key="control.id">
						<n-form>
							<n-grid x-gap="12" :cols="3">
								<n-gi>
									<n-form-item label="Control type">
										<n-input size="small" round :value="control.controlType" readonly disabled />
									</n-form-item>
								</n-gi>
								<n-gi>
									<n-form-item label="Data type">
										<n-input size="small" round :value="control.dataType" readonly disabled />
									</n-form-item>
								</n-gi>
								<n-gi>
									<n-form-item label="Parameter name">
										<n-input size="small" round :value="control.name" readonly disabled />
									</n-form-item>
								</n-gi>
								<n-gi>
									<n-form-item v-if="control.controlType === 'button'" label="Default value">
										<n-input-number v-if="control.dataType == 'float'" v-model:value="control.defaultValue" size="small" round step="0.1" />
										<n-input-number v-if="control.dataType == 'int'" v-model:value="control.defaultValue" size="small" round />
										<n-checkbox v-if="control.dataType == 'bool'" v-model:checked="control.defaultValue" />
									</n-form-item>
								</n-gi>
								<n-gi>
									<n-form-item v-if="control.controlType != 'range'" label="Set value">
										<n-input-number v-if="control.dataType == 'float' || control.dataType == 'int'" v-model:value="control.setValue" size="small" round />
										<n-checkbox v-else v-model:checked="control.setValue" />
									</n-form-item>
								</n-gi>
								<n-gi>
									<n-form-item label="Label">
										<n-input size="small" v-model:value="control.label" />
									</n-form-item>
								</n-gi>
							</n-grid>
							<n-space justify="end">
								<n-button type="primary" :loading="controlsUpdateLoading.has(control.id)" @click="updateParameterControl(control)">Save</n-button>
								<n-button type="error" >Delete</n-button>
							</n-space>
						</n-form>
					</n-card>
				</n-space>
			</template>

			<div class="spacer"></div>
		</template>
		</n-config-provider>
	</div>
</template>

<script>
import axios from "axios";
import { darkTheme, useMessage } from "naive-ui";
import { Plus } from "@vicons/fa";

import Dropzone from "./components/Dropzone.vue";

export default {
	components: { Dropzone, Plus },
	expose: [ "updateBoards" ],
	setup() {
		window.$message = useMessage();
	},
	data() {
		return {
			darkTheme,
			newBoardName: "",
			boards: null,
			currentBoard: null,
			currentBoardData: {},
			currentAvatar: null,
			droppedAvatar: null,
			controlsUpdateLoading: new Set(),
			currentParameterControl: { // is reset in openAvatarFile
				label: "",
				selectedParameter: null,
				controlType: null,
				defaultValue: null,
				setValue: null,
			}
		}
	},
	watch: {
		processedAvatarData() {
			if (this.processedAvatarData === null || !(this.processedAvatarData.id in this.currentBoardData.avatars)) return;

			this.changeAvatar(this.processedAvatarData.id);
		},
		newControlSelectedParameter() {
			this.currentParameterControl.controlType = null;
			this.currentParameterControl.defaultValue = null;
			this.currentParameterControl.setValue = null;
		},
		"currentParameterControl.controlType": function() {
			this.currentParameterControl.defaultValue = null;
			this.currentParameterControl.setValue = null;
		},
	},
	computed: {
		boardSelectOptions() {
			if (this.boards == null) return [];

			return Object.entries(this.boards).map(entry => {
				return { label: entry[1].name, value: entry[0] };
			});
		},
		avatarSelectOptions() {
			if (this.boards == null || this.currentBoard == null) return [];

			return Object.entries(this.boards[this.currentBoard].avatars).map(entry => {
				return { label: entry[1].name, value: entry[0] };
			});
		},
		canAddAvatar() {
			return this.droppedAvatar !== null 
				&& this.droppedAvatar.data !== null 
				&& this.boards !== null
				&& this.currentBoard !== null
				&& !(this.droppedAvatar.data.id in this.boards[this.currentBoard].avatars);
		},
		canAddParameterControl() {
			return this.processedAvatarData !== null
				&& this.newControlSelectedParameter !== null
				&& this.currentParameterControl.label !== ""
				&& (
					(this.currentParameterControl.controlType === 'button' && this.currentParameterControl.setValue !== null && this.currentParameterControl.defaultValue !== null)
					|| (this.currentParameterControl.controlType === 'toggle' && this.currentParameterControl.setValue !== null)
					|| (this.currentParameterControl.controlType === 'range')
				);
		},
		processedAvatarData() {
			if (this.droppedAvatar == null || this.droppedAvatar.data == null) return null;

			return {
				name: this.droppedAvatar.data.name,
				id: this.droppedAvatar.data.id,
				parameters: this.droppedAvatar.data.parameters.filter(param => "input" in param).map(param => {
					return {
						name: param.name,
						type: param.input.type,
					};
				}),
			};
		},
		newControlSelectOptions() {
			if (this.processedAvatarData === null) return [];

			return this.processedAvatarData.parameters.map((param, index) => {
				return { label: `${param.name} (${param.type})`, value: index };
			});
		},
		newControlSelectedParameter() {
			if (this.currentParameterControl.selectedParameter === null) return null;

			return this.processedAvatarData.parameters[this.currentParameterControl.selectedParameter];
		},
		newControlTypeOptions() {
			if (this.newControlSelectedParameter === null) return [];

			switch (this.newControlSelectedParameter.type) {
				case "Int":
				case "Bool":
					return [
						{ label: "Button", value: "button" },
						{ label: "Toggle", value: "toggle" },
					];
				case "Float":
					return [
						{ label: "Button", value: "button" },
						{ label: "Toggle", value: "toggle" },
						{ label: "Range (Rotary)", value: "range" },
					];
				default:
					return [];
			}
		},
		boardUrl() {
			if (this.boards == null || this.currentBoard == null) return "";

			return `${window.location.origin}/b/${this.currentBoard}`;
		},
		currentAvatarData() {
			if (this.currentBoardData === null || this.currentAvatar == null) return null;

			return this.currentBoardData.avatars[this.currentAvatar];
		}
	},
	methods: {
		async updateBoards() {
			const resp = await axios.get("/api/admin/boards");
			this.boards = resp.data.boards;

			if (this.currentBoard !== null) {
				this.currentBoardData = Object.assign({ newPassword: "" }, this.boards[this.currentBoard]);
			}
		},
		changeBoard(boardId) {
			this.currentBoard = boardId;
			this.currentBoardData = Object.assign({ newPassword: "" }, this.boards[boardId]);
			this.currentAvatar = null;
		},
		changeAvatar(avatarId) {
			this.currentAvatar = avatarId;
		},
		openAvatarFile(file) {
			this.droppedAvatar = { error: null, data: null };
			this.currentParameterControl = {
				label: "",
				selectedParameter: null,
				controlType: null,
				defaultValue: null,
				setValue: null,
			};

			if (file.type != "application/json") {
				this.droppedAvatar.error = "The dropped file is not a JSON file";
				return;
			}

			const reader = new FileReader();
			reader.onload = evt => {
				try {
				this.droppedAvatar.data = JSON.parse(evt.target.result);
				} catch(e) {
				this.droppedAvatar.error = "Could not parse JSON";
				}
			}
			reader.readAsText(file);
		},
		addAvatar() {
			axios.post(`/api/admin/b/${this.currentBoard}/add-avatar`, {
				avatar: {
				id: this.droppedAvatar.data.id,
				name: this.droppedAvatar.data.name,
				}
			}).then(resp => {
				window.$message.success("Successfully added avatar");
				return this.updateBoards();
			}).catch(err => {
				window.$message.error("Error while adding avatar");
			});
		},
		addBoard() {
			axios.post("/api/admin/create-board").then(resp => {
				window.$message.success(`Successfully created board ${resp.data.board.name}`);
				return this.updateBoards();
			}).catch(err => {
				window.$message.error("Error while creating board");
			})
		},
		addParameterControl() {
			axios.post(`/api/admin/b/${this.currentBoard}/a/${this.currentAvatar}/create-parameter`, {
				parameter: {
					name: this.newControlSelectedParameter.name,
					dataType: this.newControlSelectedParameter.type.toLowerCase(),
					controlType: this.currentParameterControl.controlType,
					setValue: this.currentParameterControl.setValue,
					defaultValue: this.currentParameterControl.defaultValue,
					label: this.currentParameterControl.label,
				}
			}).then(resp => {
				return this.updateBoards();
			}).catch(err => {
				window.$message.error("Error while adding parameter:");
			});
		},
		renameBoard() {
			axios.put(`/api/admin/b/${this.currentBoard}/name`, { name: this.currentBoardData.name }).then(resp => {
				return this.updateBoards();
			}).catch(err => {});
		},
		setBoardPassword(newPassword) {
			axios.put(`/api/admin/b/${this.currentBoard}/password`, { password: newPassword }).then(resp => {
				return this.updateBoards();
			}).catch(err => {});
		},
		updateParameterControl(control) {
			this.controlsUpdateLoading.add(control.id);
			axios.put(`/api/admin/b/${this.currentBoard}/a/${this.currentAvatar}/p/${control.id}`, { parameter: control }).then(resp => {
				return this.updateBoards();
			}).catch(err => {
				window.$message.error("Error while updating parameter");
			}).finally(() => {
				this.controlsUpdateLoading.delete(control.id);
			});
		},
		deleteParameterControl(control_id) {
			axios.delete(`/api/admin/${this.currentBoard}/a/${this.currentAvatar}/p/${control_id}`).then(resp => {
				return this.updateBoards();
			}).catch(err => {
				window.$message.error("Error while deleting parameter");
			});
		},
	},
	async created() {
		await this.updateBoards();
	}
};
</script>
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
			<n-collapse-item title="Icons">
				<n-card>
					<n-grid :cols="8">
						<n-gi v-for="icon in icons" :key="icon.id">
							<n-space :vertical="true" align="center">
								<n-image width="100" height="100" :src="'/i/' + icon.id" />
								<n-button secondary round type="error" @click="deleteIcon(icon.id)">
									<template #icon>
										<n-icon><IconTrash /></n-icon>
									</template>
								</n-button>
							</n-space>
						</n-gi>
					</n-grid>

					<n-divider />

					<n-upload name="icon" action="/api/admin/upload-icon" :show-file-list="false" :on-finish="files => updateIcons()" >
						<n-button>Upload Icon</n-button>
					</n-upload>
				</n-card>
			</n-collapse-item>
		</n-collapse>

		<n-divider />

		<n-select :on-update:value="changeBoard" :value="currentBoard" :options="boardSelectOptions" placeholder="Select board"></n-select>

		<div class="spacer"></div>

		<template v-if="currentBoard !== null">
			<n-text>You can open this board under this URL: <n-a :href="boardUrl" target="_blank">{{ boardUrl }}</n-a></n-text>

			<n-divider />

			<n-collapse style="margin-bottom: 20px">
				<n-collapse-item title="Rename/Delete/Duplicate board">
					<n-card>
						<n-space vertical size="large">
							<n-input v-model:value="currentBoardData.name" placeholder="Board name" />

							<n-space justify="space-between">
								<n-space>
									<n-popconfirm @positive-click="deleteBoard">
										<template #icon>
											<n-icon color="red">
												<IconExclamationCircle />
											</n-icon>
										</template>
										<template #trigger>
											<n-button type="error">Delete board</n-button>
										</template>
										Are you sure you want to delete this board?
									</n-popconfirm>

									<n-button type="info" @click="duplicateBoard">Duplicate board</n-button>
								</n-space>
								
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
				<n-collapse-item title="Default board">
					<n-card>
						<n-space vertical size="large">
							<n-checkbox :modelValue="defaultBoard === currentBoard" :on-update:checked="v => defaultBoard = (v ? currentBoard : null)">
								Set this board as the default
							</n-checkbox>

							<n-text>
								Setting a board as the default makes it accessible under the root URL, i.e.:
								<n-a :href="$location.origin + '/'" target="_blank">{{ $location.origin + '/' }}</n-a>,
								but all other settings (like a configured password) still function the same.
							</n-text>

							<n-space justify="end">
								<n-button @click="setDefaultBoard()">Save</n-button>
							</n-space>
						</n-space>
					</n-card>
				</n-collapse-item>
			</n-collapse>

			<n-card>
				<n-space vertical size="large">
					<n-text>Drop an avatar OSC JSON file to add it to the board or to update its controls. You can find these JSON files in a subdirectory of this path (click to select and copy-paste into Windows Explorer):</n-text>

					<n-input readonly size="small" value="%HOMEPATH%\AppData\LocalLow\VRChat\VRChat\OSC" ref="oscPathInput" @click="$refs.oscPathInput.select()"></n-input>
					
					<Dropzone @avatar="handleDroppedAvatar"></Dropzone>

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
								<n-select v-model:value="currentParameterControl.selectedParameter" placeholder="Select parameter" :options="newControlSelectOptions" filterable />
							</n-form-item>
							<n-collapse-transition :show="newControlSelectedParameter !== null">
								<n-form-item label="Control type">
									<!-- <n-select v-model:value="currentParameterControl.controlType" placeholder="Select control type" :options="newControlTypeOptions" :disabled="newControlSelectedParameter === null" /> -->
									<n-radio-group v-model:value="currentParameterControl.controlType">
										<n-radio-button
											v-for="option in newControlTypeOptions"
											:key="option.value"
											:value="option.value"
										>
											{{ option.label }}
										</n-radio-button>
									</n-radio-group>
								</n-form-item>
							</n-collapse-transition>
							<n-collapse-transition :show="currentParameterControl.controlType == 'toggle' || currentParameterControl.controlType == 'button'">
								<n-grid :cols="2" :y-gap="10">
									<n-gi :span="2">
										<n-text v-if="currentParameterControl.controlType == 'button'">
											The button will always toggle between the <i>current</i> value and the <i>set value</i>, but if the server has not received a value for this parameter yet, it needs a default value to reset it to.
											You should set this to the default value configured for the parameter in Unity.
										</n-text>
										<n-text v-if="currentParameterControl.controlType == 'toggle'">
											The toggle will always toggle between the <i>default</i> value and the <i>set value</i>.
											If the value is not set to the <i>set value</i> it will display untoggled and clicking on it will set the value again.
											You should set this to the default value configured for the parameter in Unity.
										</n-text>
									</n-gi>
									<n-gi>
										<n-form-item label="Default value">
											<n-input-number 
												v-if="newControlSelectedParameter.type == 'Float' || newControlSelectedParameter.type == 'Int'" 
												v-model:value="currentParameterControl.defaultValue" 
												size="small"
											/>
											<n-checkbox v-else v-model:checked="currentParameterControl.defaultValue" />
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
							</n-collapse-transition>
						</n-form>

						<n-button type="primary" :disabled="!canAddParameterControl" @click="addParameterControl">
							<template #icon>
								<n-icon>
									<IconPlus />
								</n-icon>
							</template>Add
						</n-button>
					</n-card>

					<n-divider />
				</template>

				<draggable
					v-if="currentAvatarData !== null"
					:list="currentAvatarControlsSorted"
					:animation="200"
					item-key="id"
					handle=".handle"
					@start="handleDragStart"
					@end="handleDragEnd"
				>
					<template #item="{element: control}">
						<n-card :key="control.id" class="control-card">
							<div class="handle">
								<n-icon size="20">
									<icon-grip />
								</n-icon>
							</div>
							<n-form>
								<n-grid :cols="6" x-gap="12">
									<n-gi>
										<n-space :vertical="true" align="stretch">
											<n-space v-if="control.icon !== null" justify="center">
												<n-image width="100" height="100" :src="'/i/' + control.icon" :preview-disabled="true" />
											</n-space>
											<n-empty v-else description="No icon set" size="medium">
												<template #icon>
													<n-icon>
														<IconImage />
													</n-icon>
												</template>
											</n-empty>
											<n-select :options="iconSelectOptions" :render-tag="renderIconSelectTag" :render-label="renderIconSelectOption" v-model:value="control.icon" />
											<!-- <n-button secondary round>
												<template #icon>
													<n-icon><IconEdit /></n-icon>
												</template>
											</n-button> -->
										</n-space>
									</n-gi>

									<n-gi :span="5">
										<n-grid x-gap="12" :cols="8">
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
											<n-gi span="2">
												<n-form-item label="Parameter name">
													<n-input size="small" round :value="control.parameterName" readonly disabled />
												</n-form-item>
											</n-gi>
											<n-gi span="2">
												<n-form-item label="Input address">
													<n-input size="small" round :value="currentAvatarParams[control.parameterName].input" readonly disabled />
												</n-form-item>
											</n-gi>
											<n-gi span="2">
												<n-form-item label="Output address">
													<n-input size="small" round :value="currentAvatarParams[control.parameterName].output" readonly disabled />
												</n-form-item>
											</n-gi>
											<n-gi span="2">
												<n-form-item v-if="control.controlType != 'range'" label="Default value">
													<n-input-number v-if="control.dataType == 'float' || control.dataType == 'int'" v-model:value="control.defaultValue" size="small" round />
													<n-checkbox v-else v-model:checked="control.defaultValue" />
												</n-form-item>
											</n-gi>
											<n-gi span="2">
												<n-form-item v-if="control.controlType != 'range'" label="Set value">
													<n-input-number v-if="control.dataType == 'float' || control.dataType == 'int'" v-model:value="control.setValue" size="small" round />
													<n-checkbox v-else v-model:checked="control.setValue" />
												</n-form-item>
											</n-gi>
											<n-gi span="4">
												<n-form-item label="Label">
													<n-input size="small" v-model:value="control.label" />
												</n-form-item>
											</n-gi>
										</n-grid>
									</n-gi>
								</n-grid>
								<n-space justify="end">
									<n-button secondary type="primary" :loading="buttonLoading.has('control-' + control.id)" @click="updateParameterControl(control)">Save</n-button>
									<n-popconfirm @positive-click="deleteParameterControl(control.id)">
										<template #trigger>
											<n-button secondary type="error">Delete</n-button>
										</template>
										Are you sure you want to delete this control?
									</n-popconfirm>
								</n-space>
							</n-form>
						</n-card>
					</template>
				</draggable>
				
				<n-space v-if="controlOrder !== null">
					<n-button
						type="info"
						:loading="buttonLoading.has('save-order')"
						@click="saveControlOrder()"
					>Save control order</n-button>
				</n-space>
			</template>

			<div class="spacer"></div>
		</template>
		</n-config-provider>
	</div>
</template>

<script>
import axios from "axios";
import { darkTheme, NText, useMessage } from "naive-ui";
import { Plus, Trash, ExclamationCircle, Image, GripVertical } from "@vicons/fa";
import { h } from "vue";
import draggable from "vuedraggable";

import ImageSelectOption from "./components/ImageSelectOption.vue";
import Dropzone from "./components/Dropzone.vue";

export default {
	components: {
		Dropzone,
		draggable,
		IconPlus: Plus,
		IconTrash: Trash,
		IconExclamationCircle: ExclamationCircle,
		IconImage: Image,
		IconGrip: GripVertical,
	},
	expose: [ "updateBoards" ],
	setup() {
		window.$message = useMessage();
	},
	data() {
		return {
			darkTheme,
			newBoardName: "",
			icons: [],
			boards: null,
			defaultBoard: null,
			registeredParams: {},
			currentBoard: null,
			currentBoardData: {},
			currentAvatar: null,
			droppedAvatar: null,
			controlOrder: null,
			buttonLoading: new Set(),
			currentParameterControl: { // is reset in openAvatarFile
				label: "",
				selectedParameter: null,
				controlType: null,
				defaultValue: null,
				setValue: null,
			},
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
			this.currentParameterControl.setValue = null;

			if (this.newControlSelectedParameter != null) {
				switch (this.newControlSelectedParameter.type) {
					case "Bool":
						this.currentParameterControl.defaultValue = false;
						break;
					case "Int":
						this.currentParameterControl.defaultValue = 0;
						break;
					default:
						this.currentParameterControl.defaultValue = null;
						break;
				}
			} else {
				this.currentParameterControl.defaultValue = null;
			}
		},
	},
	computed: {
		$location() {
			return window.location;
		},
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
					|| (this.currentParameterControl.controlType === 'toggle' && this.currentParameterControl.setValue !== null && this.currentParameterControl.defaultValue !== null)
					|| (this.currentParameterControl.controlType === 'range')
				);
		},
		processedAvatarData() {
			if (this.droppedAvatar == null || this.droppedAvatar.data == null) return null;

			return {
				name: this.droppedAvatar.data.name,
				id: this.droppedAvatar.data.id,
				parameters: this.droppedAvatar.data.parameters.filter(param => "input" in param).map(param => {
					const supported = param.input.type === param.output.type;
					const type = supported ? param.input.type : null;

					return {
						name: param.name,
						inputAddress: param.input.address,
						outputAddress: param.output.address,
						supported,
						type,
					};
				}),
			};
		},
		newControlSelectOptions() {
			if (this.processedAvatarData === null) return [];

			return this.processedAvatarData.parameters.map((param, index) => {
				if (param.supported) {
					return { label: `${param.name} (${param.type})`, value: index };
				} else {
					return { label: `${param.name} (Not supported)`, value: index, disabled: true };
				}
			});
		},
		newControlSelectedParameter() {
			if (this.currentParameterControl.selectedParameter == null) return null;

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
		},
		currentAvatarControlsSorted() {
			if (this.currentAvatarData === null) return [];

			const controlOrder = (this.controlOrder !== null) ? this.controlOrder : this.currentAvatarData.controlOrder;

			return controlOrder.filter(cid => cid in this.currentAvatarData.controls).map(control_id => {
				return this.currentAvatarData.controls[control_id];
			});
		},
		iconSelectOptions() {
			return [{ value: null, label: "No icon" }].concat(this.icons.map(icon => {
				return { value: icon.id, label: icon.id };
			}));
		},
		currentAvatarParams() {
			if (!(this.currentAvatar in this.registeredParams)) {
				return {};
			} else {
				return this.registeredParams[this.currentAvatar];
			}
		},
	},
	methods: {
		async updateBoards() {
			const resp = await axios.get("/api/admin/boards");
			this.boards = resp.data.boards;
			this.defaultBoard = resp.data.defaultBoard;

			await this.updateRegisteredParams();

			if (this.currentBoard !== null) {
				this.currentBoardData = Object.assign({ newPassword: "" }, this.boards[this.currentBoard]);
			}
		},
		async updateIcons() {
			const resp = await axios.get("/api/admin/icons");
			this.icons = resp.data.icons;
		},
		async updateRegisteredParams() {
			const resp = await axios.get("/api/admin/parameters");
			this.registeredParams = resp.data.parameters;
		},
		resetCurrentParameterControl() {
			this.currentParameterControl = {
				label: "",
				selectedParameter: null,
				controlType: null,
				defaultValue: null,
				setValue: null,
			};
		},
		changeBoard(boardId) {
			this.currentBoard = boardId;
			if (boardId !== null) {
				this.currentBoardData = Object.assign({ newPassword: "" }, this.boards[boardId]);
			}
			this.currentAvatar = null;
		},
		changeAvatar(avatarId) {
			this.currentAvatar = avatarId;
			this.controlOrder = null; // reset control order
		},
		handleDroppedAvatar(avatarData) {
			this.droppedAvatar = { error: null, data: null };
			this.resetCurrentParameterControl();

			this.droppedAvatar.data = avatarData;
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
			});
		},
		addParameterControl() {
			axios.post(`/api/admin/b/${this.currentBoard}/a/${this.currentAvatar}/create-control`, {
				control: {
					dataType: this.newControlSelectedParameter.type.toLowerCase(),
					controlType: this.currentParameterControl.controlType,
					setValue: this.currentParameterControl.setValue,
					defaultValue: this.currentParameterControl.defaultValue,
					label: this.currentParameterControl.label,
				},
				parameter: this.newControlSelectedParameter,
			}).then(resp => {
				if (this.controlOrder) {
					this.controlOrder.push(resp.data.control.id);
				}
				return this.updateBoards();
			}).then(() => {
				this.resetCurrentParameterControl();
			}).catch(err => {
				window.$message.error("Error while adding control:");
			});
		},
		renameBoard() {
			axios.put(`/api/admin/b/${this.currentBoard}/name`, { name: this.currentBoardData.name }).then(resp => {
				return this.updateBoards();
			}).catch(err => {});
		},
		setDefaultBoard() {
			axios.put(`/api/admin/b/${this.currentBoard}/default`, { default: this.currentBoard === this.defaultBoard }).then(resp => {
				return this.updateBoards();
			}).catch(err => {});
		},
		deleteBoard() {
			axios.delete(`/api/admin/b/${this.currentBoard}`).then(resp => {
				this.changeBoard(null);
				return this.updateBoards();
			}).catch(err => {});
		},
		duplicateBoard() {
			axios.post(`/api/admin/create-board`, null, {
				params: {
					duplicate: this.currentBoard,
				}
			}).then(resp => {
				window.$message.success(`Successfully created board ${resp.data.board.name}`);
				return this.updateBoards();
			}).catch(err => {
				window.$message.error("Error while duplicating board");
			});
		},
		setBoardPassword(newPassword) {
			axios.put(`/api/admin/b/${this.currentBoard}/password`, { password: newPassword }).then(resp => {
				return this.updateBoards();
			}).catch(err => {});
		},
		updateParameterControl(control) {
			this.buttonLoading.add("control-" + control.id);
			axios.put(`/api/admin/b/${this.currentBoard}/a/${this.currentAvatar}/p/${control.id}`, { control }).then(resp => {
				return this.updateBoards();
			}).catch(err => {
				window.$message.error("Error while updating control");
			}).finally(() => {
				this.buttonLoading.delete("control-" + control.id);
			});
		},
		saveControlOrder() {
			this.buttonLoading.add("save-order");
			axios.put(`/api/admin/b/${this.currentBoard}/a/${this.currentAvatar}/control-order`, { order: this.controlOrder }).then(resp => {
				return this.updateBoards();
			}).then(() => {
				this.controlOrder = null;
			}).catch(err => {
				window.$message.error("Error while saving control order");
			}).finally(() => {
				this.buttonLoading.delete("save-order");
			});
		},
		deleteParameterControl(control_id) {
			axios.delete(`/api/admin/b/${this.currentBoard}/a/${this.currentAvatar}/p/${control_id}`).then(resp => {
				if (this.controlOrder) {
					const idx = this.controlOrder.findIndex(cid => cid === control_id);
					if (idx >= 0) {
						this.controlOrder.splice(idx, 1);
					}
				}
				return this.updateBoards();
			}).catch(err => {
				window.$message.error("Error while deleting control");
			});
		},
		deleteIcon(icon_id) {
			axios.delete(`/api/admin/icon/${icon_id}`).then(resp => {
				return Promise.all([
					this.updateIcons(),
					this.updateBoards(),
				]);
			}).catch(err => {
				window.$message.error("Error while deleting icon");
			});
		},
		renderIconSelectOption(option) {
			return h(ImageSelectOption, { value: option.value, label: option.label });
		},
		renderIconSelectTag(option) {
			return h(NText, {}, () => option.option.label);
		},
		handleDragStart() {
			if (!this.controlOrder) {
				this.controlOrder = [ ...this.currentAvatarData.controlOrder ];
			}
		},
		handleDragEnd(evt) {
			const { oldIndex, newIndex } = evt;
			const moveId = this.controlOrder[oldIndex];

			this.controlOrder.splice(oldIndex, 1);
			this.controlOrder.splice(newIndex, 0, moveId);
		},
	},
	async created() {
		await this.updateBoards();
		await this.updateIcons();
	}
};
</script>

<style lang="scss">
.control-card {
	position: relative;
	padding-left: 30px;
	margin-bottom: 10px;

	.handle {
		position: absolute;
		left: 0px;
		top: 0px;
		background-color: #323232;
		height: 100%;
		width: 30px;
		display: flex;
		justify-content: center;
		align-items: center;
		cursor: grab;

		&:hover {
			background-color: #545454;
		}

		&:active {
			cursor: grabbing;
		}
	}
}
</style>
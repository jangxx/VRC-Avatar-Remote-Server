<template>
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

		<n-form-item label="Select board" :show-feedback="false">
			<n-select :on-update:value="changeBoard" :value="currentBoard" :options="boardSelectOptions" placeholder="Select board"></n-select>
		</n-form-item>

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

			<n-form-item label="Select avatar" :show-feedback="false">
				<n-select :on-update:value="changeAvatar" :value="currentAvatar" :options="avatarSelectOptions" placeholder="Select avatar" v-if="avatarSelectOptions.length > 0"></n-select>
			</n-form-item>

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

				<n-space justify="space-between" align="center" style="margin-bottom: 20px">
					<n-h2 style="margin-bottom: 0px">Control groups</n-h2>
					<n-space>
						<n-button
							v-if="!groupLayoutEditable"
							type="info"
							@click="groupLayoutEditable = true"
						>
							<template #icon>
								<n-icon>
									<IconOrder />
								</n-icon>
							</template>
							Edit layout
						</n-button>

						<n-button
							v-if="groupLayoutEditable"
							type="info"
							:loading="buttonLoading.has('save-order')"
							@click="saveControlLayout()"
						>
							Save layout
						</n-button>

						<n-button
							v-if="groupLayoutEditable"
							@click="resetGroupControlLayout(); groupLayoutEditable = false"
						>
							Reset layout
						</n-button>

						<n-button type="primary" @click="openCreateGroupModal" :disabled="groupLayoutEditable">
							<template #icon>
								<n-icon>
									<IconPlus />
								</n-icon>
							</template>
							Create group
						</n-button>
					</n-space>
				</n-space>

				<draggable
					v-if="currentAvatarData !== null"
					:list="currentAvatarGroupsSorted"
					:animation="200"
					item-key="id"
					handle=".group-handle"
					@end="handleGroupDragEnd"
					:disabled="!groupLayoutEditable"
				>
					<template #item="{element: group}">
						<div class="group">
							<div class="group-header">
								<div class="group-handle" v-if="groupLayoutEditable">
									<n-icon size="20">
										<icon-grip-horz />
									</n-icon>
								</div>
								<div class="group-collapse" @click="collapsedGroups.has(group.id) ? collapsedGroups.delete(group.id) : collapsedGroups.add(group.id)">
									<n-icon size="20">
										<icon-collapsed v-if="collapsedGroups.has(group.id)" />
										<icon-opened v-else />
									</n-icon>
								</div>
								<div class="group-title">
									<span v-if="group.id == 'default'">Default Group</span>
									<span v-else-if="group.name == null || group.name.length == 0">Unnamed Group</span>
									<span v-else>{{ group.name }}</span>
								</div>
							</div>

							<n-collapse-transition :show="!collapsedGroups.has(group.id)">
								<n-card class="group-settings-card" v-if="!groupLayoutEditable && group.id != 'default'">
									<n-space>
										<n-button @click="editGroupDialog(group.id)">Edit group</n-button>

										<n-popconfirm @positive-click="deleteGroup(group.id)">
											<template #icon>
												<n-icon color="red">
													<IconExclamationCircle />
												</n-icon>
											</template>
											<template #trigger>
												<n-button type="error" :loading="buttonLoading.has(`delete-group-${group.id}`)">Delete group</n-button>
											</template>
											Are you sure you want to delete this group? All its controls will be moved back into the default group.
										</n-popconfirm>
									</n-space>
								</n-card>

								<draggable
									:list="currentAvatarGroupControlsSorted[group.id]"
									:animation="200"
									item-key="id"
									handle=".control-handle"
									group="movable-controls"
									@end="handleControlDragEnd"
									class="group-content"
									:disabled="!groupLayoutEditable"
									:data-group-id="group.id"
								>
									<template #item="{element: control}">
										<control-settings
											v-model="this.currentAvatarData.controls[control.id]"
											@update="updateBoards()"
											@error="showError"
											:input-parameter="currentAvatarParams[control.parameterName].input"
											:output-parameter="currentAvatarParams[control.parameterName].output"
											:board-id="currentBoard"
											:avatar-id="currentAvatar"
											:icons="icons"
											:layout-edit-mode="groupLayoutEditable"
										/>
									</template>
								</draggable>
							</n-collapse-transition>
						</div>
					</template>
				</draggable>
			</template>

			<div class="spacer"></div>
		</template>

		<n-modal
			v-model:show="createGroupModalVisible"
			preset="card"
			title="Create group"
			style="max-width: 600px"
		>
			<n-form>
				<n-form-item label="Name">
					<n-input v-model:value="currentGroup.name" placeholder="Name of the group" />
				</n-form-item>
			</n-form>
			<template #footer>
				<n-space justify="end">
					<n-button type="error" @click="createGroupModalVisible = false">
						Cancel
					</n-button>
					<n-button type="primary" @click="addGroup()" :loading="currentGroup.loading">
						Save
					</n-button>
				</n-space>
			</template>
		</n-modal>

		<n-modal
			v-model:show="editGroupModalVisible"
			preset="card"
			title="Edit group"
			style="max-width: 600px"
		>
			<n-form>
				<n-form-item label="Name">
					<n-input v-model:value="currentGroup.name" placeholder="Name of the group" />
				</n-form-item>
			</n-form>
			<template #footer>
				<n-space justify="end">
					<n-button type="error" @click="editGroupModalVisible = false">
						Cancel
					</n-button>
					<n-button type="primary" @click="updateCurrentGroup()" :loading="currentGroup.loading">
						Save
					</n-button>
				</n-space>
			</template>
		</n-modal>

	</n-config-provider>
</template>

<script>
import axios from "axios";
import { darkTheme, NText, useMessage } from "naive-ui";
import { Plus, Trash, ExclamationCircle, GripLines, CaretDown, CaretRight, ListOl } from "@vicons/fa";

import draggable from "vuedraggable";

import Dropzone from "./components/Dropzone.vue";
import ControlSettingsComponent from "./components/ControlSettingsComponent.vue";

export default {
	components: {
		Dropzone,
		draggable,
		ControlSettings: ControlSettingsComponent,
		IconPlus: Plus,
		IconTrash: Trash,
		IconExclamationCircle: ExclamationCircle,
		IconGripHorz: GripLines,
		IconCollapsed: CaretRight,
		IconOpened: CaretDown,
		IconOrder: ListOl,
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
			buttonLoading: new Set(),
			collapsedGroups: new Set(),
			currentParameterControl: { // is reset in openAvatarFile
				label: "",
				selectedParameter: null,
				controlType: null,
				defaultValue: null,
				setValue: null,
			},
			currentGroup: {
				name: "",
				id: null,
				loading: false,
			},
			currentGroupControlLayout: [],
			groupLayoutEditable: false,
			createGroupModalVisible: false,
			editGroupModalVisible: false,
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
				parameters: Object.fromEntries(this.droppedAvatar.data.parameters.filter(param => "input" in param).map(param => {
					const supported = param.input.type === param.output.type;
					const type = supported ? param.input.type : null;

					return [
						param.name,
						{
							name: param.name,
							inputAddress: param.input.address,
							outputAddress: param.output.address,
							supported,
							type,
						}
					];
				})),
			};
		},
		newControlSelectOptions() {
			if (this.processedAvatarData === null) return [];

			const parameters = Object.values(this.processedAvatarData.parameters).sort((a, b) => a.name.localeCompare(b.name));

			return parameters.map((param, index) => {
				if (param.supported) {
					return { label: `${param.name} (${param.type})`, value: param.name };
				} else {
					return { label: `${param.name} (Not supported)`, value: param.name, disabled: true };
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
		currentAvatarGroupsSorted() {
			if (this.currentAvatarData === null) return [];

			return this.currentGroupControlLayout.map(groupDesc => {
				return { ...this.currentAvatarData.groups[groupDesc.id], id: groupDesc.id }; // insert id into the group object
			});
		},
		currentAvatarGroupControlsSorted() {
			if (this.currentAvatarData === null) return {};

			const entries = this.currentGroupControlLayout
				.map(groupDesc => {
					return [
						groupDesc.id,
						groupDesc.controls.map(cid => this.currentAvatarData.controls[cid] )
					]
				});

			return Object.fromEntries(entries);
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

				if (this.currentAvatar !== null) {
					this.resetGroupControlLayout();
				}
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
		resetGroupControlLayout() {
			if (this.currentAvatarData === null) return;

			this.currentGroupControlLayout = [];

			for (const groupId of this.currentAvatarData.groupOrder) {
				const groupControls = {
					id: groupId,
					controls: [...this.currentAvatarData.groups[groupId].controls]
				};
				this.currentGroupControlLayout.push(groupControls);
			}
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
			this.resetGroupControlLayout();
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
				// if (this.controlOrder) {
				// 	this.controlOrder.push(resp.data.control.id);
				// }
				return this.updateBoards();
			}).then(() => {
				this.resetCurrentParameterControl();
			}).catch(err => {
				window.$message.error("Error while adding control: " + err.message);
			});
		},
		addGroup() {
			this.currentGroup.loading = true;

			axios.post(`/api/admin/b/${this.currentBoard}/a/${this.currentAvatar}/create-group`, {
				group: {
					name: this.currentGroup.name,
				},
			}).then(resp => {
				return this.updateBoards();
			}).then(() => {
				this.createGroupModalVisible = false;
			}).catch(err => {
				window.$message.error("Error while adding group: " + err.message);
			}).finally(() => {
				this.currentGroup.loading = false;
			});
		},
		deleteGroup(id) {
			this.buttonLoading.add(`delete-group-${id}`);

			axios.delete(`/api/admin/b/${this.currentBoard}/a/${this.currentAvatar}/g/${id}`).then(resp => {
				return this.updateBoards();
			}).catch(err => {
				window.$message.error("Error while deleting group: " + err.message);
			}).finally(() => {
				this.buttonLoading.delete(`delete-group-${id}`)
			});
		},
		editGroupDialog(id) {
			if (!this.currentAvatarData) return;

			const groupData = this.currentAvatarData.groups[id];

			if (!groupData) return;

			this.currentGroup.id = id;
			this.currentGroup.name = groupData.name;

			this.editGroupModalVisible = true;
		},
		updateCurrentGroup() {
			this.currentGroup.loading = true;

			axios.put(`/api/admin/b/${this.currentBoard}/a/${this.currentAvatar}/g/${this.currentGroup.id}`, {
				group: {
					name: this.currentGroup.name,
				}
			}).then(resp => {
				return this.updateBoards();
			}).then(() => {
				this.editGroupModalVisible = false;
			}).catch(err => {
				window.$message.error("Error while saving group: " + err.message);
			}).finally(() => {
				this.currentGroup.loading = false;
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
		async saveControlLayout() {
			this.buttonLoading.add("save-order");
			
			const controlGroupChanges = [];

			// turn the layout into a hashed object for faster lookups
			const controlToGroupMap = {};
			for (const groupDesc of this.currentGroupControlLayout) {
				for (const controlId of groupDesc.controls) {
					controlToGroupMap[controlId] = groupDesc.id;
				}
			}

			// figure out the differences between the current layout and the one on the server
			for (const groupId of this.currentAvatarData.groupOrder) {
				for (const controlId of this.currentAvatarData.groups[groupId].controls) {
					if (controlToGroupMap[controlId] != groupId) {
						controlGroupChanges.push({
							controlId,
							groupId: controlToGroupMap[controlId],
						})
					}
				}
			}

			try {
				// perform the moves first
				for (const change of controlGroupChanges) {
					await axios.put(`/api/admin/b/${this.currentBoard}/a/${this.currentAvatar}/p/${change.controlId}/group`, {
						groupId: change.groupId,
						position: null, // the position will be set with the control order update
					});
				}

				// update control orders
				for (const groupDesc of this.currentGroupControlLayout) {
					await axios.put(`/api/admin/b/${this.currentBoard}/a/${this.currentAvatar}/g/${groupDesc.id}/control-order`, { order: groupDesc.controls });
				}

				// finally update group order itself
				await axios.put(`/api/admin/b/${this.currentBoard}/a/${this.currentAvatar}/group-order`, { order: this.currentGroupControlLayout.map(g => g.id) });

				// get the updated data from the server to ensure consistency
				await this.updateBoards();

				this.groupLayoutEditable = false;
			} catch(err) {
				window.$message.error("Error while saving layout");
			} finally {
				this.buttonLoading.delete("save-order");
			}
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
		openCreateGroupModal() {
			this.currentGroup.name = "";
			this.createGroupModalVisible = true;
		},
		handleGroupDragEnd(evt) {
			const { oldIndex, newIndex } = evt;

			const moveGroup = this.currentGroupControlLayout.splice(oldIndex, 1);
			this.currentGroupControlLayout.splice(newIndex, 0, moveGroup[0]);
		},
		// handleDragStart() {
		// 	// if (!this.controlOrder) {
		// 	// 	this.controlOrder = [ ...this.currentAvatarData.controlOrder ];
		// 	// }
		// },
		handleControlDragEnd(evt) {
			const { oldIndex, newIndex } = evt;
			const fromGroup = evt.from.dataset.groupId;
			const toGroup = evt.to.dataset.groupId;

			const srcGroupDesc = this.currentGroupControlLayout.find(group => group.id == fromGroup);
			const dstGroupDesc = this.currentGroupControlLayout.find(group => group.id == toGroup);
			
			if (srcGroupDesc == null || dstGroupDesc == null) return;

			const moveId = srcGroupDesc.controls[oldIndex];

			srcGroupDesc.controls.splice(oldIndex, 1);
			dstGroupDesc.controls.splice(newIndex, 0, moveId);
		},
		showError(message) {
			window.$message.error(message);
		}
	},
	async created() {
		await this.updateBoards();
		await this.updateIcons();
	}
};
</script>

<style lang="scss">
.group {
	margin-bottom: 20px;

	.group-header {
		display: flex;
		align-items: center;
		margin-bottom: 15px;
		padding-bottom: 5px;
		border-bottom-style: solid;
		border-bottom-color: #545454;
		border-bottom-width: 1px;

		.group-handle, .group-collapse {
			background-color: #323232;
			height: 100%;
			width: 50px;
			display: flex;
			justify-content: center;
			align-items: center;
			margin-right: 10px;

			&:hover {
				background-color: #545454;
			}
		}
		
		.group-handle {
			cursor: grab;

			&:active {
				cursor: grabbing;
			}
		}

		.group-collapse {
			cursor: pointer;
		}

		.group-title {
			font-size: 1.5em;
		}
	}

	.group-settings-card {
		margin-bottom: 10px;
	}

//	.group-content {
//	}
}
</style>
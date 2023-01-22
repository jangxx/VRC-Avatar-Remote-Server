<template>
	<n-card :key="control.id" class="control-card" :class="{ 'layout-editable': layoutEditMode }">
		<div class="control-handle" v-if="layoutEditMode">
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
								<n-input size="small" round :value="inputParameter" readonly disabled />
							</n-form-item>
						</n-gi>
						<n-gi span="2">
							<n-form-item label="Output address">
								<n-input size="small" round :value="outputParameter" readonly disabled />
							</n-form-item>
						</n-gi>
						<n-gi span="2">
							<n-form-item v-if="control.controlType != 'range'" label="Default value">
								<n-input-number
									v-if="control.dataType == 'float' || control.dataType == 'int'"
									v-model:value="control.defaultValue"
									:disabled="layoutEditMode"
									size="small"
									round
								/>
								<n-checkbox v-else v-model:checked="control.defaultValue" :disabled="layoutEditMode" />
							</n-form-item>
						</n-gi>
						<n-gi span="2">
							<n-form-item v-if="control.controlType != 'range'" label="Set value">
								<n-input-number
									v-if="control.dataType == 'float' || control.dataType == 'int'"
									v-model:value="control.setValue"
									:disabled="layoutEditMode"
									size="small"
									round
								/>
								<n-checkbox v-else v-model:checked="control.setValue" :disabled="layoutEditMode" />
							</n-form-item>
						</n-gi>
						<n-gi span="4">
							<n-form-item label="Label">
								<n-input size="small" v-model:value="control.label" :disabled="layoutEditMode" />
							</n-form-item>
						</n-gi>
					</n-grid>
				</n-gi>
			</n-grid>
			<n-space justify="end" v-if="!layoutEditMode">
				<n-button :loading="duplicateButtonLoading" @click="duplicateParameterControl(control)">Duplicate</n-button>
				<n-button secondary type="primary" :loading="updateButtonLoading" @click="updateParameterControl(control)">Save</n-button>
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

<script>
import { Image, GripVertical } from "@vicons/fa";
import { h } from "vue";
import { NText } from "naive-ui";
import axios from "axios";

import ImageSelectOption from "./ImageSelectOption.vue";

export default {
	components: {
		IconImage: Image,
		IconGrip: GripVertical,
	},
	props: {
		boardId: String,
		avatarId: String,
		inputParameter: String,
		outputParameter: String,
		modelValue: Object,
		icons: Array,
		layoutEditMode: Boolean,
	},
	data() {
		return {
			control: this.modelValue,
			updateButtonLoading: false,
			duplicateButtonLoading: false,
		};
	},
	computed: {
		iconSelectOptions() {
			return [{ value: null, label: "No icon" }].concat(this.icons.map(icon => {
				return { value: icon.id, label: icon.id };
			}));
		},
	},
	watch: {
		control() {
			this.emit("update:modelValue", this.control);
		}
	},
	methods: {
		renderIconSelectOption(option) {
			return h(ImageSelectOption, { value: option.value, label: option.label });
		},
		renderIconSelectTag(option) {
			return h(NText, {}, () => option.option.label);
		},
		async deleteParameterControl(control_id) {
			try {
				await axios.delete(`/api/admin/b/${this.boardId}/a/${this.avatarId}/p/${control_id}`);
				this.$emit("update");
			} catch(err) {
				this.$emit("error", "Error while deleting control", err);
			}
		},
		async duplicateParameterControl(control) {
			this.duplicateButtonLoading = true;
			try {
				await axios.post(`/api/admin/b/${this.boardId}/a/${this.avatarId}/duplicate-control`, { controlId: control.id });
				this.$emit("update");
			} catch(err) {
				this.$emit("error", "Error while duplicating control", err);
			} finally {
				this.duplicateButtonLoading = false;
			}
		},
		async updateParameterControl(control) {
			this.updateButtonLoading = true;
			try {
				await axios.put(`/api/admin/b/${this.boardId}/a/${this.avatarId}/p/${control.id}`, { control });
				this.$emit("update");
			} catch(err) {
				this.$emit("error", "Error while updating control", err);
			} finally {
				this.updateButtonLoading = false;
			}
		},
	}
}
</script>

<style lang="scss">
.control-card {
	position: relative;
	margin-bottom: 10px;

	&.layout-editable {
		padding-left: 30px;
	}

	.control-handle {
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
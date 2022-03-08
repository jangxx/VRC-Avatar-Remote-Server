<template>
  <main>
    <Login v-if="!loggedIn" @attempt-login="pw => performLogin('admin', pw)" :errorMessage="loginError"></Login>
    <div v-else>
      <n-config-provider :theme="darkTheme">
        <n-h1>VRC Remote Admin</n-h1>

        <n-collapse>
          <n-collapse-item title="Add board">
            <n-card>
              <n-button type="primary" @click="addBoard">Create board</n-button>
              <n-text :type="addBoardStatus.error ? 'error' : 'info'" v-if="addBoardStatus.show" style="margin-left: 10px">
                {{ addBoardStatus.error ? addBoardStatus.error : addBoardStatus.text }}
              </n-text>
            </n-card>
          </n-collapse-item>
        </n-collapse>

        <n-divider />

        <n-select :on-update:value="changeBoard" :options="boardSelectOptions" placeholder="Select board"></n-select>

        <div class="spacer"></div>

        <template v-if="currentBoard !== null">
          <n-collapse style="margin-bottom: 20px">
            <n-collapse-item title="Rename board">
              <n-card>
                <n-form>
                  <n-form-item label="Rename board">
                    <n-input v-model:value="currentBoardData.name" placeholder="Board name" />
                  </n-form-item>
                </n-form>

                <n-button :disabled="boards[currentBoard].name == currentBoardData.name" @click="renameBoard">Rename board</n-button>
              </n-card>
            </n-collapse-item>
            <n-collapse-item title="Board password">
              <n-card>
                <n-form>
                  <n-form-item label="Password">
                    <n-input v-model:value="currentBoardData.newPassword" placeholder="Board password" />
                  </n-form-item>
                </n-form>

                <n-text :type="boards[currentBoard].password ? 'success' : 'info'">
                  {{ boards[currentBoard].password ? "Password is currently set" : "Password is currently not set" }}
                </n-text>

                <div class="spacer"></div>

                <n-button :disabled="currentBoardData.newPassword.length == 0" @click="setBoardPassword(currentBoardData.newPassword)" style="margin-right: 10px">Set password</n-button>
                <n-button type="warning" :disabled="!boards[currentBoard].password" @click="setBoardPassword(null)">Disable password</n-button>
              </n-card>
            </n-collapse-item>
          </n-collapse>

          <n-card>
            <n-text>Drop an avatar OSC JSON file to add it to the board or to update its parameters:</n-text>
            <Dropzone @file="openAvatarFile"></Dropzone>

            <div v-if="droppedAvatar !== null">
              <n-text type="error" v-if="droppedAvatar.error !== null">
                <b>Error while adding avatar</b>: {{ droppedAvatar.error }}
              </n-text>
              <n-text type="info" v-else-if="processedAvatarData !== null">
                Found avatar <b>{{ processedAvatarData.name }}</b> with <b>{{ processedAvatarData.parameters.length }}</b> input parameters.
              </n-text>
            </div>

            <n-button type="primary" v-if="canAddAvatar" @click="addAvatar" style="margin-top: 20px">Add avatar</n-button>
            <n-text :type="addAvatarStatus.error ? 'error' : 'info'" v-if="addAvatarStatus.show" style="margin-left: 10px">
              {{ addAvatarStatus.error ? addAvatarStatus.error : addAvatarStatus.text }}
            </n-text>
          </n-card>

          <n-divider />

          <n-select :on-update:value="changeAvatar" :options="avatarSelectOptions" placeholder="Select avatar"></n-select>

          <template v-if="currentAvatar !== null">
            <div class="spacer"></div>

            <n-card v-if="processedAvatarData !== null && currentAvatar == processedAvatarData.id">
              <n-form>
                <!-- TODO -->

                <!-- <n-form-item label="Board name">
                  <n-input placeholder="Board name" />
                </n-form-item> -->
              </n-form>

              <n-button type="primary">Add parameter control</n-button>
            </n-card>
          </template>

          <div class="spacer"></div>
        </template>
      </n-config-provider>
    </div>
  </main>
</template>

<script>
import axios from "axios";
import { darkTheme } from "naive-ui";

import LoginMixin from "./lib/LoginMixin";

import Login from "./components/Login.vue";
import Dropzone from "./components/Dropzone.vue";

export default {
  mixins: [ LoginMixin ],
  components: { Login, Dropzone },
  data() {
    return {
      darkTheme,
      newBoardName: "",
      boards: null,
      currentBoard: null,
      currentBoardData: {},
      currentAvatar: null,
      droppedAvatar: null,
      addAvatarStatus: { show: false, error: null, text: null },
      addBoardStatus: { show: false, error: null, text: null },
      currentParameterControl: {
        // TODO
      }
    }
  },
  watch: {
    async loggedIn(loggedIn) {
      if (loggedIn) {
        await this.updateBoards();
      }
    }
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
  },
  methods: {
    async updateBoards() {
      const resp = await axios.get("/api/admin/boards");
      this.boards = resp.data.boards;
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
      this.addAvatarStatus.show = false;
      this.addAvatarStatus.error = null;
      this.addAvatarStatus.text = null;

      axios.post(`/api/admin/b/${this.currentBoard}/add-avatar`, {
        avatar: {
          id: this.droppedAvatar.data.id,
          name: this.droppedAvatar.data.name,
        }
      }).then(resp => {
        this.addAvatarStatus.show = true;
        this.addAvatarStatus.text = "Successfully added avatar";
        return this.updateBoards();
      }).catch(err => {
        this.addAvatarStatus.show = true;
        this.addAvatarStatus.error = "Error while adding avatar";
      });
    },
    addBoard() {
      this.addBoardStatus.show = false;
      this.addBoardStatus.error = null;
      this.addBoardStatus.text = null;

      axios.post("/api/admin/create-board").then(resp => {
        this.addBoardStatus.show = true;
        this.addBoardStatus.text = `Successfully created board ${resp.data.board.name}`;
        return this.updateBoards();
      }).catch(err => {
        this.addBoardStatus.show = true;
        this.addBoardStatus.error = "Error while creating board";
      })
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
  },
  async created() {
    await this.checkLogin("admin");
  }
}
</script>

<style lang="scss">
@import "assets/style";

body {
  max-width: 1000px;
  margin-left: auto;
  margin-right: auto;
}
</style>

import React, { useState } from "react";
import { Link } from "react-router-dom";
import PropTypes from "prop-types";

const AddUser = (props) => {
  var [users, setUsers] = useState([]),
    [admin, setAdmin] = useState(false);

  var { addUsers, failRegexEvent, refreshUserData, history } = props;

  return (
    <>
      <div className="container">
        <div className="row">
          <div className="col-md-10 col-md-offset-1 col-lg-8 col-lg-offset-2">
            <div className="panel panel-default">
              <div className="panel-heading">
                <h4>Add Users</h4>
              </div>
              <div className="panel-body">
                <form>
                  <div className="form-group">
                    <textarea
                      className="form-control"
                      id="add-user-textarea"
                      rows="3"
                      placeholder="usernames separated by line"
                      onBlur={(e) => {
                        let split_users = e.target.value.split("\n");
                        setUsers(split_users);
                      }}
                    ></textarea>
                    <br></br>
                    <input
                      className="form-check-input"
                      type="checkbox"
                      value=""
                      id="admin-check"
                      onChange={(e) => setAdmin(e.target.checked)}
                    />
                    <span> </span>
                    <label className="form-check-label">Admin</label>
                  </div>
                </form>
              </div>
              <div className="panel-footer">
                <button id="return" className="btn btn-light">
                  <Link to="/">Back</Link>
                </button>
                <span> </span>
                <button
                  id="submit"
                  className="btn btn-primary"
                  onClick={() => {
                    let filtered_users = users.filter(
                      (e) =>
                        e.length > 2 &&
                        /[!@#$%^&*(),.?":{}|<>]/g.test(e) == false
                    );
                    if (filtered_users.length < users.length) {
                      let removed_users = users.filter(
                        (e) => !filtered_users.includes(e)
                      );
                      setUsers(filtered_users);
                      failRegexEvent();
                    }

                    addUsers(filtered_users, admin)
                      .then(() => refreshUserData())
                      .then(() => history.push("/"))
                      .catch((err) => console.log(err));
                  }}
                >
                  Add Users
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

AddUser.propTypes = {
  addUsers: PropTypes.func,
  failRegexEvent: PropTypes.func,
  refreshUserData: PropTypes.func,
  history: PropTypes.shape({
    push: PropTypes.func,
  }),
};

export default AddUser;
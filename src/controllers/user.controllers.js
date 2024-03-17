import asyncHandler from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { refreshToken, accessToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating refresh and access tokrn"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  // Getting the data from the request body
  const { fullName, username, email, password } = req.body;

  // Checking if any field is empty
  if (
    [fullName, email, username, password].some((field) => field?.trim === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  // Checking if the user already exists
  const userExist = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (userExist) {
    throw new ApiError(409, "User already exist");
  }

  // Uploading the files to the server local storage by Multer
  const avatarLocalPath = req.files?.avatar[0]?.path;
  //const coverImageLocalPath = req.file?.coverImage[0]?.path; // There is some problem in the coverImage, it is not uploading

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  // Further uploading the files from the server local storage to cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avatar file is required");
  }

  // Creating the new user and saving in the Database
  const user = await User.create({
    fullName,
    avatar: avatar?.url || "",
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  // Removing password and refreshToken from the response sent back to the user
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  // Checking if the created user exist in the Database
  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  // Send the response back to the frontend
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered Successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  // Get all the required things from the request
  const { username, email, password } = req.body;

  // Check if the either username or email is there
  if (!username || !email) {
    throw new ApiError(400, "Username or email is required");
  }

  // Check if the username or email exists in the Database
  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "User does ont exist");
  }

  // Check if the password is correct
  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }

  // Generating access and refresh token for the user
  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  // Creating options so that the cookies cannot be changed from the frontend
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User loggedIn Successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: { refreshToken: undefined },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User Logged out successfully"));
});
export { registerUser, loginUser, logoutUser };

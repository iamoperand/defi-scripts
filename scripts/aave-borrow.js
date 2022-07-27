const { ethers, getNamedAccounts } = require("hardhat")
const { getWeth, AMOUNT } = require("./get-weth")

async function main() {
    const { deployer } = await getNamedAccounts()

    // ----- Deposit -----
    // the protocol treats everything as an ERC20 token, so have to convert ETH to ERC20 i.e. WETH.
    await getWeth()

    // get the lending pool i.e. where to deposit
    const lendingPool = await getLendingPool(deployer)
    console.log(`LendingPool address: ${lendingPool.address}`)

    // approve to spend the funds
    const wethTokenAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
    await approveErc20(wethTokenAddress, lendingPool.address, AMOUNT, deployer)
    console.log("Depositing...")
    await lendingPool.deposit(wethTokenAddress, AMOUNT, deployer, 0)
    console.log("Deposited!")

    // ----- Borrow -----
    let { availableBorrowsETH, totalDebtETH } = await getUserBorrowData(lendingPool, deployer)

    // convert ETH to DAI, since we need to borrow DAI
    const daiPrice = await getDaiPrice()
    const daiAmountToBorrow = availableBorrowsETH.toString() * 0.95 * (1 / daiPrice.toNumber())
    console.log(`You can borrow ${daiAmountToBorrow} DAI`)

    const daiAmountToBorrowInWei = ethers.utils.parseEther(daiAmountToBorrow.toString())
    const daiTokenAddress = "0x6b175474e89094c44da98b954eedeac495271d0f"
    await borrowDai(daiTokenAddress, lendingPool, daiAmountToBorrowInWei, deployer)
    await getUserBorrowData(lendingPool, deployer)
}

async function borrowDai(daiAddress, lendingPool, daiAmountToBorrowInWei, account) {
    const borrowTx = await lendingPool.borrow(daiAddress, daiAmountToBorrowInWei, 1, 0, account)
    await borrowTx.wait(1)
    console.log("You've borrowed!")
}

async function getDaiPrice() {
    const daiEthPriceFeed = await ethers.getContractAt(
        "AggregatorV3Interface",
        "0x773616E4d11A78F511299002da57A0a94577F1f4"
    )

    const price = (await daiEthPriceFeed.latestRoundData())[1]
    console.log(`The DAI/ETH price is ${price.toString()}`)
    return price
}

async function getUserBorrowData(lendingPool, account) {
    const { totalCollateralETH, totalDebtETH, availableBorrowsETH } =
        await lendingPool.getUserAccountData(account)

    console.log(`You have ${totalCollateralETH} worth of ETH deposited.`)
    console.log(`You have ${totalDebtETH} worth of ETH borrowed.`)
    console.log(`You can borrow ${availableBorrowsETH} worth of ETH.`)
    return { totalDebtETH, availableBorrowsETH }
}

async function getLendingPool(account) {
    const lendingPoolAddressesProvider = await ethers.getContractAt(
        "ILendingPoolAddressesProvider",
        "0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5",
        account
    )

    const lendingPoolAddress = await lendingPoolAddressesProvider.getLendingPool()
    const lendingPool = await ethers.getContractAt("ILendingPool", lendingPoolAddress, account)
    return lendingPool
}

async function approveErc20(erc20Address, spenderAddress, amountToSpend, account) {
    const erc20Token = await ethers.getContractAt("IERC20", erc20Address, account)
    const tx = await erc20Token.approve(spenderAddress, amountToSpend)
    await tx.wait(1)
    console.log("Approved!")
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })

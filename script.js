const axios = require("axios");
const mysql = require('mysql');
const pairs = [];

var con = mysql.createConnection({
  host: "testdev.rungila.com",
  user: "user1",
  password: "_kVvPeE(S!#[XE_85@",
  database: "arbitrage",
});


con.connect(function (err) {
  if (err) throw err;
   console.log("Connected!");
});




const init = async ()=> {
        await con.query(
          `SELECT * FROM m_exchanges  ORDER by exchange_id ASC`,
          async (err, exresult) => {
            if (err) throw err;
            for(let exchange=0; exchange < exresult.length; exchange++){

                let waitLoop = new Promise(async (resolve,reject)=>{            

                    let otherExchanges = exresult.filter(function(element){            
                        return element.exchange_id !== exresult[exchange].exchange_id;
                    });

                    let parameter = {
                        baseExchange: exresult[exchange],
                        otherExchanges: otherExchanges 
                    } 

                    await getBaseExchangePair(parameter,resolve,reject);

                })

                await waitLoop;
                if(exchange == exresult.length -1){
                    console.log(pairs,"----")
                }
            } 
          }
        )
}

const getBaseExchangePair = async (values, nextLoop, loopReject) => {
  let getAllUrlConfig = {
    method: "GET",
    url: `http://localhost:5000/allPairs/${values.baseExchange.exchange_id}`,
    headers: {
      "Content-Type": "application/json",
    },
  };

  axios(getAllUrlConfig).then(async (pairsResponse) => {
    if (pairsResponse.data.data.length > 0) {      
        pairs.push({[values.baseExchange.name]:pairsResponse.data.data})
    //   for(let j=0; j < pairsResponse.data.data.length; j++){
    //     await new Promise(async (resolve, reject) => {
    //         let pair = pairsResponse.data.data[j]
    //         await checkOtherExchange(pair, values, resolve, reject);            
    //         if (j == pairsResponse.data.data.length-1) {
    //           nextLoop(1);
    //         }
    //       });
    //   }
      
    } else {
      nextLoop(1);
    }
  });
};

const checkOtherExchange = async (pair, values, nextLoop, rejectLoop) => {
  
  for (let k = 0; k < values.otherExchanges.length; k++) {
    let otherEx = values.otherExchanges[k];
    await new Promise((resolve, reject) => {
      let checkPairUrlConfig = {
        method: "POST",
        url: `http://localhost:5000/checkPair`,
        headers: {
          "Content-Type": "application/json",
        },
        data: {
          id: otherEx.exchange_id,
          token0: pair.token0.id,
          token1: pair.token1.id,
        },
      };
      axios(checkPairUrlConfig).then(async (checkPair) => {
        if (checkPair.data.data.length > 0) {
          let symbol0 = `${checkPair.data.data[0].token0.symbol}/${checkPair.data.data[0].token1.symbol}`;
          let symbol1 = `${pair.token0.symbol}/${pair.token1.symbol}`;
          var post = `('${symbol0}','${otherEx.exchange_id}','${checkPair.data.data[0].id}','${checkPair.data.data[0].token0.id}','${checkPair.data.data[0].token1.id}'),('${symbol1}','${values.baseExchange.exchange_id}','${pair.id}','${pair.token0.id}','${pair.token1.id}')`;
          var sql = `INSERT INTO m_common_pair (symbol,exchange_id,pairtoken,token0,token1) values ${post} ON DUPLICATE KEY UPDATE symbol= VALUES(symbol),exchange_id=VALUES(exchange_id),pairtoken=VALUES(pairtoken),token0=VALUES(token0),token1=VALUES(token1)`;
          var query = con.query(sql, post, function (err, res) {
            if (err) throw err;            
            resolve(0);
          });
          console.log(query.sql);
        } else {
          resolve(0);
        }
      });
    });
    if (k == values.otherExchanges.length-1) {
        nextLoop(1);
      }
  }
 
  
};

init()